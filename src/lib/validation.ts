import { z } from 'zod';

// ── Shared primitives ────────────────────────────────────────────────────

const nonEmpty = (max: number) =>
  z.string().trim().min(1, 'Required').max(max);

const optionalString = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => v ?? null);

const cuid = z.string().min(1, 'ID is required');

// Money must be a positive whole rupiah amount.
// Accepts string (e.g. "1.500.000") or number; downstream we normalize via toMoneyInt.
const moneyInput = z
  .union([z.string(), z.number()])
  .refine((v) => {
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 && Number.isInteger(n);
  }, 'Amount must be a positive whole number')
  .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10)));

// ── Habit ────────────────────────────────────────────────────────────────

export const createHabitSchema = z.object({
  name: nonEmpty(200),
  icon: z.string().max(20).optional(),
  category: nonEmpty(100).optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  target: z.number().int().positive().max(1000).optional(),
  targetType: z.enum(['daily', 'weekly', 'monthly']).optional(),
  color: z.string().max(20).optional(),
  reminder: z.string().max(50).nullish(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  notes: z.string().max(2000).nullish(),
  trackTime: z.boolean().optional(),
  targetTime: z.string().max(10).nullish(),
  trackLastDone: z.boolean().optional(),
  lastDoneInterval: z.string().max(10).nullish(),
  groupId: cuid.nullish(),
  // Vacation mode (PHASE1-HABIT). vacationMode toggles the pause; vacationEnd
  // is the auto-resume date (null = indefinite vacation). vacationEnd is
  // coerced to a Date when provided as a string ("yyyy-MM-dd").
  vacationMode: z.boolean().optional(),
  vacationEnd: z.coerce.date().nullish(),
});
export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = createHabitSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
  order: z.number().int().min(0).max(100000).optional(),
});
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

// ── Habit Log ────────────────────────────────────────────────────────────

export const createHabitLogSchema = z.object({
  date: z.coerce.date(),
  completed: z.boolean().optional(),
  value: z.number().int().min(0).max(1000).optional(),
  completedAt: z.string().max(50).nullish(),
});
export type CreateHabitLogInput = z.infer<typeof createHabitLogSchema>;

export const batchHabitLogsSchema = z.object({
  logs: z.array(
    z.object({
      habitId: cuid,
      date: z.coerce.date(),
      completed: z.boolean(),
      value: z.number().int().min(0).max(1000).optional(),
      completedAt: z.string().max(50).nullish(),
    })
  ).min(1, 'At least one log is required').max(500, 'Too many logs in one batch'),
});
export type BatchHabitLogsInput = z.infer<typeof batchHabitLogsSchema>;

// ── Finance Transaction ─────────────────────────────────────────────────

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: moneyInput,
  category: nonEmpty(100),
  description: optionalString(500),
  date: z.coerce.date(),
  notes: optionalString(2000),
  source: nonEmpty(100).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ── Fund Source ──────────────────────────────────────────────────────────

export const createFundSourceSchema = z.object({
  name: nonEmpty(100),
  emoji: z.string().max(20).optional(),
  balance: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateFundSourceInput = z.infer<typeof createFundSourceSchema>;

export const updateFundSourceSchema = createFundSourceSchema.partial();
export type UpdateFundSourceInput = z.infer<typeof updateFundSourceSchema>;

export const updateBalanceSchema = z.object({
  balance: z.number().int().refine((v) => Number.isInteger(v), 'Balance must be a whole number'),
});
export type UpdateBalanceInput = z.infer<typeof updateBalanceSchema>;

// ── Budget ───────────────────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  category: nonEmpty(100),
  amount: moneyInput,
  period: z.enum(['weekly', 'monthly']).optional(),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = createBudgetSchema.partial();
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

// ── Finance Category ─────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  type: z.enum(['income', 'expense']),
  name: nonEmpty(100),
  emoji: z.string().max(20).optional(),
  color: z.string().max(20).optional(),
  order: z.number().int().min(0).optional(),
  trackLastDone: z.boolean().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Goal ─────────────────────────────────────────────────────────────────

export const createGoalSchema = z.object({
  title: nonEmpty(200),
  description: optionalString(2000),
  deadline: z.coerce.date().nullish(),
  // Goal progress is 0-100 (percentage). Max 100 is correct for goals.
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  milestones: z.string().max(10000).optional(),
  achievement: optionalString(2000),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema.partial();
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

// BUG-FINANCE-CAL BUG-5: removed dead schemas createJournalSchema /
// updateJournalSchema / CreateJournalInput / UpdateJournalInput and
// createLearningTopicSchema / CreateLearningTopicInput. The Journal +
// LearningTopic Prisma models + their API routes were deleted in commit
// 50e5482 ("hapus 3 orphan features") and nothing imports these schemas
// anymore (verified via grep). They were just dead code that confused
// readers into thinking the features still existed.

// ── Daily Log ────────────────────────────────────────────────────────────

export const createDailyLogSchema = z.object({
  date: z.coerce.date(),
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  sleep: z.number().min(0).max(24).optional(),
  notes: optionalString(5000),
});
export type CreateDailyLogInput = z.infer<typeof createDailyLogSchema>;

// ── Habit Group ──────────────────────────────────────────────────────────

export const createHabitGroupSchema = z.object({
  name: nonEmpty(100),
  emoji: z.string().max(20).optional(),
  color: z.string().max(20).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateHabitGroupInput = z.infer<typeof createHabitGroupSchema>;

// Partial update schema for PUT /api/habit-groups. `id` is required (taken
// from the request body since the route uses a body-based `id` rather than
// a URL param). At least one updatable field must be present alongside `id`.
export const updateHabitGroupSchema = z
  .object({
    id: z.string().min(1),
    name: nonEmpty(100).optional(),
    emoji: z.string().max(20).optional(),
    color: z.string().max(20).optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.emoji !== undefined || d.color !== undefined || d.order !== undefined,
    { message: 'No updatable fields provided' }
  );
export type UpdateHabitGroupInput = z.infer<typeof updateHabitGroupSchema>;

// ── Habit Option ─────────────────────────────────────────────────────────

export const createHabitOptionSchema = z.object({
  type: z.enum(['category', 'priority', 'difficulty']),
  name: nonEmpty(100),
  color: z.string().max(50).optional(),
  xp: z.number().int().min(0).max(10000).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateHabitOptionInput = z.infer<typeof createHabitOptionSchema>;
export const updateHabitOptionSchema = createHabitOptionSchema.partial();

// ── Settings ─────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  userName: nonEmpty(100).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  // BUGHUNT-OTHER-1 BUG-L12: validate hex color format (#RRGGBB). Previously
  // any string up to 20 chars was accepted, allowing invalid values like
  // "red", "#xyz", or "#1234567" to be stored — which would break CSS
  // rendering downstream (silent fallback to default colors with no
  // indication of what went wrong).
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color (use #RRGGBB)').optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color (use #RRGGBB)').optional(),
  weekStart: z.enum(['monday', 'sunday', 'saturday']).optional(),
  language: z.string().max(10).optional(),
  targetCompletion: z.number().int().min(1).max(100).optional(),
  // Daily budget target in whole rupiah. 0 = unset (ring hidden in UI).
  // Max 100jt as a sane upper bound.
  dailyBudgetTarget: z.number().int().min(0).max(100_000_000).optional(),
  // Array of expense category names to use as the basis for the Daily Recap
  // month-end projection. Empty array = use all expense categories (default).
  // The API serializes this to a JSON string before storing in the DB.
  // Max 1 category — the UI is a single-select dropdown (was multi-select
  // chips in Fase 1 v1, but that caused lag + complexity). Tightening from
  // .max(100) to .max(1) ensures the schema matches the UI: the client can
  // never send more than 1 category, and legacy multi-category data gets
  // rejected on the next PUT (which will overwrite with a single value).
  projectionCategoryIds: z.array(z.string().min(1).max(100)).max(1).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ── Savings Goal ─────────────────────────────────────────────────────────

export const createSavingsGoalSchema = z.object({
  name: nonEmpty(200),
  emoji: z.string().max(20).optional(),
  targetAmount: moneyInput,
  // currentAmount is optional on create — defaults to 0 in the DB. If the
  // user provides one (e.g. they already have some savings set aside), it
  // must be a non-negative whole rupiah amount.
  currentAmount: z
    .union([z.string(), z.number()])
    .refine((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) && n >= 0 && Number.isInteger(n);
    }, 'Current amount must be a non-negative whole number')
    .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10)))
    .optional(),
  sourceName: optionalString(100),
  deadline: z.coerce.date().nullish(),
});
export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;

export const updateSavingsGoalSchema = z.object({
  name: nonEmpty(200).optional(),
  emoji: z.string().max(20).optional(),
  // targetAmount must be positive whole rupiah.
  targetAmount: moneyInput.optional(),
  // currentAmount accepts 0 + negatives? No — savings can't go below 0.
  // We accept whole rupiah (>= 0). PUT /api/finance/savings-goals/[id]
  // uses this for full edits.
  currentAmount: z
    .union([z.string(), z.number()])
    .refine((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) && n >= 0 && Number.isInteger(n);
    }, 'Current amount must be a non-negative whole number')
    .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10)))
    .optional(),
  sourceName: optionalString(100),
  deadline: z.coerce.date().nullish(),
  isCompleted: z.boolean().optional(),
});
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;

// PATCH-style "adjust amount" payload used by the Tambah Tabungan / Tarik
// buttons in the UI. `delta` is the signed change (positive for tambah,
// negative for tarik). The API clamps the resulting currentAmount at >= 0.
export const adjustSavingsGoalSchema = z.object({
  delta: z
    .union([z.string(), z.number()])
    .refine((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) && n !== 0 && Number.isInteger(n);
    }, 'Delta must be a non-zero whole number')
    .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10))),
});
export type AdjustSavingsGoalInput = z.infer<typeof adjustSavingsGoalSchema>;

// ── Helper: safe parse for API routes ───────────────────────────────────

import { NextResponse } from 'next/server';

export function parseOr400<T>(
  schema: z.ZodType<T>,
  input: unknown
): { success: true; data: T } | { success: false; response: Response } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  const message = firstError
    ? `${firstError.path.join('.') || 'input'}: ${firstError.message}`
    : 'Invalid input';
  return {
    success: false,
    response: NextResponse.json({ error: message }, { status: 400 }),
  };
}

// ── Weekly Budget ────────────────────────────────────────────────────────
export const weeklyBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format. Use YYYY-MM'),
  week: z.number().int().min(1).max(4),
  target: z.number().int().min(0),
  rollover: z.boolean().optional().default(true),
});

// ── Recurring Transaction (PHASE2-FINANCE-1) ────────────────────────────
// Auto-create transactions on a schedule (Actual Budget + Firefly III style).
// dayOfMonth (1-31) required when frequency = 'monthly'.
// dayOfWeek (0-6, 0=Sunday) required when frequency = 'weekly'.
// interval is the "every N" multiplier (e.g. every 2 weeks → interval=2).

export const createRecurringSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: moneyInput,
    category: nonEmpty(100),
    description: optionalString(500),
    source: nonEmpty(100).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    dayOfMonth: z.number().int().min(1).max(31).nullish(),
    dayOfWeek: z.number().int().min(0).max(6).nullish(),
    interval: z.number().int().min(1).max(365).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullish(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) => d.frequency !== 'monthly' || (d.dayOfMonth != null),
    { message: 'dayOfMonth wajib diisi untuk frequency "monthly"', path: ['dayOfMonth'] }
  )
  .refine(
    (d) => d.frequency !== 'weekly' || (d.dayOfWeek != null),
    { message: 'dayOfWeek wajib diisi untuk frequency "weekly"', path: ['dayOfWeek'] }
  )
  .refine(
    (d) => !d.endDate || !d.startDate || d.endDate.getTime() >= d.startDate.getTime(),
    { message: 'endDate harus setelah startDate', path: ['endDate'] }
  );
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;

export const updateRecurringSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  amount: moneyInput.optional(),
  category: nonEmpty(100).optional(),
  description: optionalString(500),
  source: nonEmpty(100).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  interval: z.number().int().min(1).max(365).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;

// ── Transaction Rule (PHASE2-FINANCE-1) ─────────────────────────────────
// Auto-categorization rule (Firefly III style). conditionField/op/value
// define the matcher; actionField/value define the override applied on match.
// First-match-wins: rules are evaluated by priority asc, then createdAt asc.

export const createRuleSchema = z.object({
  name: nonEmpty(100),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  conditionField: z.enum(['description', 'source', 'amount']),
  conditionOp: z.enum(['contains', 'equals', 'startsWith', 'gt', 'lt']),
  conditionValue: nonEmpty(500),
  actionField: z.enum(['category', 'source']),
  actionValue: nonEmpty(100),
});
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = createRuleSchema.partial();
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
