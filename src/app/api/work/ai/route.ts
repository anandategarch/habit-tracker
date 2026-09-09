// POST /api/work/ai — Asisten AI "Rapikan catatanku" (Task 17-a).
// Server-side ONLY (z-ai-web-dev-sdk tidak boleh di client).
// Input : { text } — catatan kerjaan berantakan bebas.
// Output: { tasks: [{title}], notes: [{content}], summary } (1 kalimat Indonesia).
import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { badRequest, handleApiError, readJsonBody, requireNonEmptyString } from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { WORK_TITLE_MAX, WORK_NOTES_MAX } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

const LLM_TIMEOUT_MS = 45_000;
const MAX_TASKS = 8;
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT =
  'Kamu adalah asisten meja kerja pribadi di aplikasi Rutina (pengguna Indonesia, pekerja lepas/solo). ' +
  'Tugasmu: memilah catatan kerjaan yang berantakan menjadi dua kelompok. ' +
  'Balas HANYA dengan JSON valid (tanpa teks lain, tanpa penjelasan, tanpa code fence) dengan bentuk: ' +
  '{"tasks":[{"title":"..."}],"notes":[{"content":"..."}]}. ' +
  'Aturan pemilahan: ' +
  '"tasks" = hal yang harus DIKERJAKAN (punya unsur aksi), sertakan petunjuk waktu bila ada dalam catatan, contoh judul: "kirim laporan — jam 16:00"; ' +
  '"notes" = info / hal kecil / pengingat non-aksi (mis. "beli kopi kantor", referensi, ide). ' +
  'Maksimal 8 tasks. Judul tugas maks 120 karakter, isi catatan maks 500 karakter. ' +
  'Seluruh teks bahasa Indonesia sehari-hari yang ramah. Jangan menambah hal yang tidak ada di catatan.';

type AiTask = { title: string };
type AiNote = { content: string };
type AiParsed = { tasks: AiTask[]; notes: AiNote[] };

/**
 * Ambil substring JSON {...} pertama yang balanced (dengan kesadaran string
 * berquote supaya brace di dalam teks tidak merusak hitungan kedalaman).
 */
function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** Parser toleran: buang code fence, cari {...} pertama, JSON.parse —
 *  dengan dua lapis penyelamat: (1) JSON.parse langsung, (2) bila gagal,
 *  bersihkan koma buntut sebelum }/] dan quote pintar lalu parse ulang. */
function parseAiPayload(content: string): AiParsed | null {
  const cleaned = content.replace(/```(?:json)?/gi, '').trim();
  const candidate = extractFirstJsonObject(cleaned);
  if (!candidate) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // LLM kadang menyisakan koma buntut (trailing comma) atau quote pintar —
    // bersihkan lalu coba sekali lagi sebelum menyerah.
    const rescued = candidate
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(rescued);
    } catch {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.tasks) && !Array.isArray(obj.notes)) return null;

  const normItem = (item: unknown, key: 'title' | 'content'): string | null => {
    let value: unknown = item;
    if (item !== null && typeof item === 'object') {
      value = (item as Record<string, unknown>)[key];
    }
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const tasks = (Array.isArray(obj.tasks) ? obj.tasks : [])
    .map((t) => normItem(t, 'title'))
    .filter((t): t is string => t !== null)
    .map((t) => ({ title: t.slice(0, WORK_TITLE_MAX) }))
    .slice(0, MAX_TASKS);

  const notes = (Array.isArray(obj.notes) ? obj.notes : [])
    .map((n) => normItem(n, 'content'))
    .filter((n): n is string => n !== null)
    .map((n) => ({ content: n.slice(0, WORK_NOTES_MAX) }));

  if (tasks.length === 0 && notes.length === 0) return null;
  return { tasks, notes };
}

export async function POST(req: Request) {
  try {
    await ensureWorkTables();
    const body = await readJsonBody(req);
    const text = requireNonEmptyString(body.text, 'Catatan masih kosong — tulis dulu catatan yang mau dirapikan');
    if (text.length > 2000) throw badRequest('Catatan terlalu panjang (maks 2000 karakter)');

    const zai = await ZAI.create();
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: text },
    ];

    let parsed: AiParsed | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !parsed; attempt++) {
      const llmPromise = zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS);
      });
      const completion = await Promise.race([llmPromise, timeoutPromise]);
      const content = String(
        (completion as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content ?? ''
      );
      parsed = parseAiPayload(content);
      if (!parsed && attempt < MAX_ATTEMPTS) {
        // Percobaan kedua: tegaskan format JSON mentah tanpa teks lain.
        messages.push({ role: 'user', content: 'Balas ULANGI HANYA JSON valid: {"tasks":[{"title":"..."}],"notes":[{"content":"..."}]} — tanpa kalimat pembuka/penutup.' });
      }
    }

    if (!parsed) {
      // Respons LLM tidak bisa diparse → pesan Indonesia yang bisa ditindaklanjuti.
      return NextResponse.json(
        { error: 'AI tidak bisa membaca catatan itu, coba tulis lagi' },
        { status: 400 }
      );
    }

    const total = parsed.tasks.length + parsed.notes.length;
    const summary =
      `Sudah kupilah catatanmu jadi ${parsed.tasks.length} tugas` +
      (parsed.notes.length > 0 ? ` dan ${parsed.notes.length} catatan` : '') +
      ` dari ${total === 1 ? 'satu hal' : total + ' hal'} yang kamu tulis.`;

    return NextResponse.json({ tasks: parsed.tasks, notes: parsed.notes, summary });
  } catch (error) {
    return handleApiError(error, 'work/ai:POST');
  }
}
