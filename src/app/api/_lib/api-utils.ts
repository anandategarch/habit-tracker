// ---------------------------------------------------------------------------
// src/app/api/_lib/api-utils.ts — helper bersama untuk seluruh API route.
// Folder diawali "_" = private (tidak menjadi route di Next.js App Router).
//
// Konvensi (lihat recovery/API-CONTRACT.md):
//  * Semua tanggal logis = hari Jakarta (lib/timezone).
//  * HabitLog/DailyLog.date = UTC-midnight; Transaction.date = 12:00Z-anchored
//    (waktu dinding Jakarta disimpan sebagai komponen UTC); completedAt = ISO +07:00.
//  * Error response konsisten: { error: 'pesan Indonesia' } + status 400/404/500.
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';

// ── Tipe struktural baris transaksi (subset kolom Prisma) ───────────────────
// Dipakai helper transfer/saldo agar route bisa mengoper hasil findMany
// penuh maupun `select` parsial tanpa kehilangan type-safety.

/** Baris transaksi lengkap ( bentuk serializeTransaction ). */
export interface TxRow {
  id: string;
  type: string;
  amount: number;
  category: string;
  sourceId: string | null;
  description: string;
  notes: string | null;
  tags: string;
  date: Date;
  // Task 60-f (audit 59-b3): penanda kelompok hasil Split (nullable).
  groupId?: string | null;
  transferPairId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Subset untuk meta transfer / saldo (route boleh select parsial). */
export interface TxLike {
  id: string;
  type: string;
  amount: number;
  category: string;
  sourceId: string | null;
  transferPairId: string | null;
}

export interface SourceRowLike {
  id: string;
  initialBalance: number;
}

// ── Error helpers ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError(400, message);
}

export function notFound(message = 'Data tidak ditemukan'): ApiError {
  return new ApiError(404, message);
}

/** Penanganan error terpusat: ApiError → statusnya; lainnya → 500 tanpa stack. */
export function handleApiError(error: unknown, label: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[api:${label}]`, error);
  return NextResponse.json({ error: 'Terjadi kesalahan internal server' }, { status: 500 });
}

/** Parse body JSON dengan guard ketat (JSON invalid → 400). */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Body JSON tidak valid');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Body harus berupa objek JSON');
  }
  return body as Record<string, unknown>;
}

// ── Validasi tipe dasar ────────────────────────────────────────────────────

export function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

export function requireNonEmptyString(v: unknown, message: string): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(message);
  return v.trim();
}

export function requirePositiveNumber(v: unknown, message: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw badRequest(message);
  return v;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Kunci YMD 'yyyy-MM-dd' dari Date UTC-midnight (slice aman TZ). */
export function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Validasi & normalisasi string waktu 'HH:mm' → {hour, minute} atau throw. */
export function parseTimeParam(v: unknown): { hour: number; minute: number } {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) {
    throw badRequest('Format waktu tidak valid (gunakan HH:mm)');
  }
  const [hour, minute] = v.split(':').map(Number);
  return { hour, minute };
}

/**
 * Tanggal transaksi dari YMD + (opsional) waktu Jakarta.
 * Tanpa waktu → 12:00Z (dateFromYMDNoon). Dengan waktu 'HH:mm' → komponen UTC
 * = jam dinding Jakarta (12:00 + (waktu − 12:00)), sehingga YMD tetap stabil.
 */
export function transactionDate(ymd: string, time?: unknown): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (time === undefined || time === null || time === '') {
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  const { hour, minute } = parseTimeParam(time);
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
}

/** Rentang DateTime bulan penuh (inclusive start, exclusive next month). */
export function transactionMonthRange(ym: string): { gte: Date; lt: Date } {
  const [y, m] = ym.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

/** Rentang DateTime satu hari penuh (YYYY-MM-DD Jakarta → UTC-midnight based). */
export function transactionDayRange(ymd: string): { gte: Date; lt: Date } {
  return { gte: dateFromYMD(ymd), lt: dateFromYMD(shiftYmd(ymd, 1)) };
}

// ── XP ─────────────────────────────────────────────────────────────────────
// Dukung label Inggris (Easy/Medium/Hard — XP_MAP lib/dashboard-helpers)
// maupun Indonesia (Mudah/Sedang/Sulit — dipakai seed & habit-options).

const XP_WEIGHTS: Record<string, number> = {
  Easy: 5,
  Mudah: 5,
  Medium: 10,
  Sedang: 10,
  Hard: 20,
  Sulit: 20,
};

export function xpForDifficulty(difficulty: string): number {
  return XP_WEIGHTS[difficulty] ?? 10;
}

// ── Transfer (arah kaki pasangan) ──────────────────────────────────────────
// Konvensi arsip lama: kaki MASUK punya transferPairId → kaki KELUAR,
// kaki keluar transferPairId = null. API transfer baru memakai penanda
// kategori 'Transfer Keluar' / 'Transfer Masuk' + pasangan saling menunjuk.
// Resolusi urutan: kategori → arah penunjukan → yatim (dianggap keluar).

export interface TransferMeta {
  direction: 'in' | 'out' | null;
  pairId: string | null;
  pairSourceId: string | null;
}

export function buildTransferMeta(transfers: TxLike[]): Map<string, TransferMeta> {
  const byId = new Map<string, TxLike>(transfers.map((t) => [t.id, t]));
  // targetId → tx yang menunjuk ke targetId (indeks balik).
  const reverse = new Map<string, TxLike>();
  for (const t of transfers) {
    if (t.transferPairId) reverse.set(t.transferPairId, t);
  }
  const meta = new Map<string, TransferMeta>();
  for (const t of transfers) {
    let direction: 'in' | 'out' | null = null;
    if (t.category === 'Transfer Masuk') direction = 'in';
    else if (t.category === 'Transfer Keluar') direction = 'out';
    else if (t.transferPairId) direction = 'in';
    else if (reverse.has(t.id)) direction = 'out';
    else direction = 'out';

    let pairId: string | null = null;
    if (t.transferPairId && byId.has(t.transferPairId)) pairId = t.transferPairId;
    else if (reverse.has(t.id)) pairId = reverse.get(t.id)!.id;
    const pairRow = pairId ? byId.get(pairId) : undefined;

    meta.set(t.id, {
      direction,
      pairId,
      pairSourceId: pairRow?.sourceId ?? null,
    });
  }
  return meta;
}

// ── Serialisasi transaksi (bentuk kontrak finance-types) ───────────────────

export interface SourceInfo {
  id: string;
  name: string;
  emoji: string;
}

export function sourceInfoMap(sources: Array<{ id: string; name: string; emoji: string }>): Map<string, SourceInfo> {
  return new Map<string, SourceInfo>(sources.map((s) => [s.id, { id: s.id, name: s.name, emoji: s.emoji }]));
}

export function serializeTransaction(
  tx: TxRow,
  sources: Map<string, SourceInfo>,
  meta: Map<string, TransferMeta>,
): Record<string, unknown> {
  const source = tx.sourceId ? sources.get(tx.sourceId) : undefined;
  const m = tx.type === 'transfer' ? meta.get(tx.id) : undefined;
  const pairSource = m?.pairSourceId ? sources.get(m.pairSourceId) : undefined;
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    sourceId: tx.sourceId ?? null,
    sourceName: source?.name ?? null,
    sourceEmoji: source?.emoji ?? null,
    description: tx.description,
    notes: tx.notes ?? null,
    tags: tx.tags ?? '',
    date: tx.date.toISOString(),
    // Task 60-f: badge "Split" di daftar transaksi akhirnya punya sumber
    // data (dulu dead-code — tipenya ada di frontend, nilainya tidak pernah
    // dikirim). Additif: klien lama mengabaikan field baru.
    groupId: tx.groupId ?? null,
    transferPairId: m?.pairId ?? null,
    transferDirection: m?.direction ?? null,
    pairedSourceName: pairSource?.name ?? null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}

/**
 * Saldo sumber = initialBalance + income − expense + transferMasuk − transferKeluar
 * (transfer dikecualikan dari income/expense; fee transfer adalah expense biasa).
 */
export function computeSourceBalances(sources: SourceRowLike[], allTx: TxLike[]): Map<string, number> {
  const meta = buildTransferMeta(allTx.filter((t) => t.type === 'transfer'));
  const balances = new Map<string, number>(sources.map((s) => [s.id, s.initialBalance]));
  for (const t of allTx) {
    if (!t.sourceId) continue;
    const current = balances.get(t.sourceId);
    if (current === undefined) continue;
    if (t.type === 'income') balances.set(t.sourceId, current + t.amount);
    else if (t.type === 'expense') balances.set(t.sourceId, current - t.amount);
    else {
      const m = meta.get(t.id);
      if (m?.direction === 'in') balances.set(t.sourceId, current + t.amount);
      else if (m?.direction === 'out') balances.set(t.sourceId, current - t.amount);
    }
  }
  return balances;
}

// ── Kutipan motivasi statis (fallback /api/dashboard & /api/motivational-quote) ──

export const MOTIVATIONAL_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'Kebiasaan kecil yang konsisten mengalahkan motivasi besar yang datang sesekali.', author: 'Rutina' },
  { text: 'Kita adalah apa yang kita lakukan berulang-ulang. Keunggulan bukan tindakan, tapi kebiasaan.', author: 'Aristoteles' },
  { text: 'Setiap aksi yang kamu lakukan adalah suara untuk orang yang ingin kamu jadikan.', author: 'James Clear' },
  { text: 'Jangan menunggu waktu yang tepat. Waktu yang tepat dibuat, bukan ditunggu.', author: 'Rutina' },
  { text: 'Kebiasaan adalah kompas: sekali diatur, arah hidupmu mengikuti dengan sendirinya.', author: 'Rutina' },
  { text: 'Celah antara siapa kamu hari ini dan siapa kamu ingin jadi adalah apa yang kamu lakukan setiap hari.', author: 'Rutina' },
  { text: 'Ubahlah tujuan besar menjadi kebiasaan kecil — sisanya waktu yang akan mengerjakannya.', author: 'Rutina' },
  { text: 'Motivasi memulai, kebiasaan yang melanjutkan.', author: 'Rutina' },
  { text: 'Kebiasaan buruk tidak dihapus, ia digantikan oleh kebiasaan baik yang lebih mudah dilakukan.', author: 'Rutina' },
  { text: 'Satu persen lebih baik setiap hari adalah rumus perubahan yang paling kuat.', author: 'James Clear' },
  { text: 'Kalau mau memulai, jangan tunggu besok pagi. Mulai 30 detik dari sekarang.', author: 'Rutina' },
  { text: 'Kebiasaan yang kamu tanam hari ini adalah kehidupan yang kamu panen esok.', author: 'Rutina' },
  { text: 'Hari buruk bagi kebiasaanmu bukan kegagalan — itu jeda untuk bangkit lagi.', author: 'Rutina' },
  { text: 'Streak tidak harus sempurna; cukup tidak putus lama.', author: 'Rutina' },
  { text: 'Disiplin bukan hukuman, melainkan hadiah untuk versi dirimu di masa depan.', author: 'Rutina' },
  { text: 'Orang sukses bukan yang tidak pernah malas, tapi yang tidak membiarkan malas menetap.', author: 'Rutina' },
  { text: 'Bangun pagi hari ini adalah kemenangan pertama sebelum dunia sempat memintamu apa pun.', author: 'Rutina' },
  { text: 'Tandai satu kotak kecil setiap hari; setahun kemudian kamu tak akan mengenali dirimu.', author: 'Rutina' },
];

/** Kutipan deterministik per hari JAKARTA (stabil seharian, berganti
 *  tepat tengah malam WIB).
 * Task 60-f (audit 59-b5 LOW): dulu memakai tanggal UTC → kutipan berganti
 *  pukul 07:00 WIB (bukan tengah malam Jakarta) — kontradiksi dengan komentar
 *  "per hari" konvensi aplikasi. */
export function pickDailyQuote(): { text: string; author: string } {
  const today = dateFromYMD(jakartaDateString());
  // Hari sejak epoch UTC — cukup sebagai indeks harian yang stabil.
  const dayIndex = Math.floor(today.getTime() / 86_400_000);
  return MOTIVATIONAL_QUOTES[dayIndex % MOTIVATIONAL_QUOTES.length];
}
