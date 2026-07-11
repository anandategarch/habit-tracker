// Color palette for habit labels (categories, priorities, difficulties)
// Each color key maps to a set of Tailwind classes
export interface LabelColorSet {
  badge: string;    // Full badge style: bg + text + dark variants
  dot: string;      // Solid dot for priorities: bg color
  light: string;    // Light background only
  text: string;     // Text color only (for standalone text)
  hex: string;      // Hex value for inline styles
}

export const LABEL_COLORS: Record<string, LabelColorSet> = {
  gray:    { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-500', light: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', hex: '#6b7280' },
  slate:   { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-500', light: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', hex: '#64748b' },
  red:     { badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400', dot: 'bg-red-500', light: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-400', hex: '#ef4444' },
  rose:    { badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400', dot: 'bg-rose-500', light: 'bg-rose-100 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-400', hex: '#f43f5e' },
  pink:    { badge: 'bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400', dot: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-950/50', text: 'text-pink-700 dark:text-pink-400', hex: '#ec4899' },
  fuchsia: { badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-400', dot: 'bg-fuchsia-500', light: 'bg-fuchsia-100 dark:bg-fuchsia-950/50', text: 'text-fuchsia-700 dark:text-fuchsia-400', hex: '#d946ef' },
  purple:  { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400', dot: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-400', hex: '#a855f7' },
  violet:  { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400', dot: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-950/50', text: 'text-violet-700 dark:text-violet-400', hex: '#8b5cf6' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400', dot: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-950/50', text: 'text-indigo-700 dark:text-indigo-400', hex: '#6366f1' },
  blue:    { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400', dot: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-400', hex: '#3b82f6' },
  sky:     { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400', dot: 'bg-sky-500', light: 'bg-sky-100 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-400', hex: '#0ea5e9' },
  cyan:    { badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400', dot: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-950/50', text: 'text-cyan-700 dark:text-cyan-400', hex: '#06b6d4' },
  teal:    { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400', dot: 'bg-teal-500', light: 'bg-teal-100 dark:bg-teal-950/50', text: 'text-teal-700 dark:text-teal-400', hex: '#14b8a6' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400', dot: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', hex: '#10b981' },
  green:   { badge: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400', dot: 'bg-green-500', light: 'bg-green-100 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-400', hex: '#22c55e' },
  lime:    { badge: 'bg-lime-100 text-lime-700 dark:bg-lime-950/50 dark:text-lime-400', dot: 'bg-lime-500', light: 'bg-lime-100 dark:bg-lime-950/50', text: 'text-lime-700 dark:text-lime-400', hex: '#84cc16' },
  amber:   { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400', dot: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-400', hex: '#f59e0b' },
  orange:  { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400', dot: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-950/50', text: 'text-orange-700 dark:text-orange-400', hex: '#f97316' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400', dot: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-950/50', text: 'text-yellow-700 dark:text-yellow-400', hex: '#eab308' },
};

/** Get color set, fallback to gray */
export function getLabelColor(colorKey: string): LabelColorSet {
  return LABEL_COLORS[colorKey] || LABEL_COLORS.gray;
}

/** Get badge class string for an option's color */
export function getBadgeClass(colorKey: string): string {
  return getLabelColor(colorKey).badge;
}

/** Get dot class string for a priority's color */
export function getDotClass(colorKey: string): string {
  return getLabelColor(colorKey).dot;
}