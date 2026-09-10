// lib/money.ts — format rupiah & parsing nominal (dipakai finance-types & API).
export function formatRupiah(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return 'Rp0';
  if (opts?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `Rp${trimZero(value / 1_000_000_000)}M`;
    if (abs >= 1_000_000) return `Rp${trimZero(value / 1_000_000)}jt`;
    if (abs >= 10_000) return `Rp${trimZero(value / 1000)}rb`;
  }
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}
function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** '10500000' -> 'Rp 10.500.000' live preview. Input harus string digit. */
export function formatNominalInput(digits: string): string {
  if (!digits) return 'Rp 0';
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(digits)).replace(/,/g, '.');
}

/** 'Rp 10.500.000' / '10.500.000' / '10500000' -> 10500000 (number). */
export function parseNominalInput(text: string): number {
  const cleaned = text.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

/** tags koma -> array rapi. */
export function parseTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  const raw = Array.isArray(tags) ? tags : tags.split(',');
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

/** array tags -> string koma (storage). */
export function serializeTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(',');
}
