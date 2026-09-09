// lib/mood.ts — emoji mood 1..5, single source of truth (dipakai daily-check-in
// card, calendar-view mood marker, dan dashboard KPI).
export const MOOD_EMOJIS: Record<number, string> = {
  1: '😫',
  2: '🙁',
  3: '🙂',
  4: '😄',
  5: '🤩',
};

export function moodEmoji(mood: number): string {
  return MOOD_EMOJIS[Math.round(mood)] ?? MOOD_EMOJIS[3];
}

export const ENERGY_EMOJIS: Record<number, string> = {
  1: '🪫',
  2: '😴',
  3: '🙂',
  4: '⚡',
  5: '🔥',
};

export function energyEmoji(energy: number): string {
  return ENERGY_EMOJIS[Math.round(energy)] ?? ENERGY_EMOJIS[3];
}
