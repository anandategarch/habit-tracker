// ---------------------------------------------------------------------------
// Types
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: string;
  priority: string;
  difficulty: string;
  target: number;
  targetType: string;
  color: string;
  reminder: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  order: number;
  trackTime: boolean;
  targetTime: string | null;
  groupId: string | null;
  // Vacation mode (PHASE1-HABIT). vacationMode=true pauses the habit; the
  // daily-tracker excludes it from completion stats and the "Belum" filter,
  // and the habit card shows a "🏖️ Liburan" badge. vacationEnd is an ISO
  // string (or null for an indefinite vacation) — the API auto-resets
  // vacationMode to false once vacationEnd < today.
  vacationMode: boolean;
  vacationEnd: string | null;
  _count: { logs: number };
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  value: number;
  completedAt: string | null;
}
