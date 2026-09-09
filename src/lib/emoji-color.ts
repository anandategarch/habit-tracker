// lib/emoji-color.ts — warna deterministik dari emoji (avatar habit/sumber).
const PALETTE = [
  '#14b8a6', // teal
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#84cc16', // lime
  '#ec4899', // pink
  '#f97316', // orange
  '#64748b', // slate
];

export function deriveColorFromEmoji(emoji: string): string {
  let hash = 0;
  for (let i = 0; i < emoji.length; i++) {
    hash = (hash * 31 + emoji.codePointAt(i)!) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function tintFromEmoji(emoji: string, alpha = 0.15): string {
  const hex = deriveColorFromEmoji(emoji).replace('#', '');
  const int = parseInt(hex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
