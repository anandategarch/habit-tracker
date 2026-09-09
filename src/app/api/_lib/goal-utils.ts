// Helper goal: milestones JSON string ↔ array (dipakai routes goals).
import type { Goal as GoalRow } from '@prisma/client';
import { badRequest } from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';

/** milestones string (JSON array) → array aman; rusak → []. */
export function parseMilestones(raw: string | null | undefined): Array<{ text: string; done: boolean }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is { text: string; done?: boolean } => typeof m === 'object' && m !== null)
      .map((m) => ({
        text: typeof m.text === 'string' ? m.text : '',
        done: m.done === true,
      }))
      .filter((m) => m.text.trim().length > 0);
  } catch {
    return [];
  }
}

export function serializeGoal(goal: GoalRow) {
  return { ...goal, milestones: parseMilestones(goal.milestones) };
}

/** Validasi milestones dari body → string JSON siap simpan. */
export function validateMilestones(v: unknown): string {
  if (!Array.isArray(v)) throw badRequest('Milestones harus berupa array');
  if (v.length > 100) throw badRequest('Milestones maksimal 100 item');
  const items: Array<{ text: string; done: boolean }> = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) throw badRequest('Item milestone tidak valid');
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (!text) throw badRequest('Teks milestone wajib diisi');
    if (text.length > 500) throw badRequest('Teks milestone terlalu panjang');
    items.push({ text, done: rec.done === true });
  }
  return JSON.stringify(items);
}

/** Validasi deadline dari body (hanya dipanggil bila field dikirim). */
export function validateDeadline(v: unknown): string | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !isValidYMD(v)) {
    throw badRequest('Format deadline tidak valid (yyyy-MM-dd)');
  }
  return v;
}
