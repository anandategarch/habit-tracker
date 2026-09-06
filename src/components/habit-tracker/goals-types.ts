// ---------------------------------------------------------------------------
// Types
// Extracted from goals.tsx during PHASE-A-3.
//
// `Milestone` is the client-side shape used by the form (with optional
// stable `id` for React keys). `Goal` is the API/db shape — `milestones`
// is stored as a JSON string and parsed via `parseMilestones` (see
// goals-helpers.ts). `GoalFormData` is the form state used by the
// Add/Edit dialog.
// ---------------------------------------------------------------------------

export interface Milestone {
  id?: string; // optional stable id for React keys (generated client-side)
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  progress: number;
  priority: string;
  status: string;
  milestones: string; // JSON string
  achievement: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalFormData {
  id?: string;
  title: string;
  description: string;
  deadline: string;
  priority: string;
  milestones: Milestone[];
}
