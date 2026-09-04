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
