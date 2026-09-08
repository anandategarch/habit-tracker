// ── Mood / energy / sleep scales for the daily check-in ───────────────────
//
// Shared by the tracker's "Check-in Harian" card (src/components/habit-tracker/
// daily-check-in-card.tsx) and the calendar's mood emoji overlay. The emoji map
// is IDENTICAL to the one the dashboard's MoodEmoji component uses (1 😢 →
// 5 😊), so all three surfaces agree on the same scale.
//
// Kept as a tiny standalone module (NOT imported from calendar-view.tsx or
// dashboard-helpers.tsx) so light consumers don't pull heavy component bundles.

/** Emoji per mood level 1–5 (same map as calendar-view + dashboard MoodEmoji). */
export const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😔',
  3: '😐',
  4: '🙂',
  5: '😊',
};

/** Short Indonesian label per mood level — used for aria-labels ("Mood: bahagia"). */
export const MOOD_LABELS: Record<number, string> = {
  1: 'sedih',
  2: 'buruk',
  3: 'biasa',
  4: 'baik',
  5: 'bahagia',
};

/** Short Indonesian label per energy level 1–5 — used for aria-labels. */
export const ENERGY_LABELS: Record<number, string> = {
  1: 'sangat lelah',
  2: 'lelah',
  3: 'sedang',
  4: 'berenergi',
  5: 'penuh energi',
};

/** Get the mood emoji for a level, with a safe fallback. */
export function moodEmoji(level: number | null | undefined): string {
  if (level == null) return '😐';
  return MOOD_EMOJIS[level] ?? '😐';
}

/** Get the Indonesian mood label for a level (empty string for null/unknown). */
export function moodLabel(level: number | null | undefined): string {
  if (level == null) return '';
  return MOOD_LABELS[level] ?? '';
}

/** Get the Indonesian energy label for a level (empty string for null/unknown). */
export function energyLabel(level: number | null | undefined): string {
  if (level == null) return '';
  return ENERGY_LABELS[level] ?? '';
}
