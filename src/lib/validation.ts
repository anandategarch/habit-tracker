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
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  milestones: z.string().max(10000).optional(),
  achievement: optionalString(2000),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema.partial();
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

// ── Challenge ────────────────────────────────────────────────────────────

export const createChallengeSchema = z.object({
  title: nonEmpty(200),
  description: optionalString(2000),
  duration: z.number().int().min(1).max(3650).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const updateChallengeSchema = createChallengeSchema.partial();
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;

// ── Badge / Reward ───────────────────────────────────────────────────────

export const createBadgeSchema = z.object({
  name: nonEmpty(200),
  description: nonEmpty(500),
  icon: z.string().max(20).optional(),
  requirement: nonEmpty(500),
  unlocked: z.boolean().optional(),
});
export type CreateBadgeInput = z.infer<typeof createBadgeSchema>;

export const createRewardSchema = z.object({
  name: nonEmpty(200),
  description: optionalString(500),
  unlockCondition: nonEmpty(500),
  xpCost: z.number().int().min(0).optional(),
  status: z.enum(['locked', 'unlocked', 'redeemed']).optional(),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

// ── Journal ──────────────────────────────────────────────────────────────

export const createJournalSchema = z.object({
  date: z.coerce.date(),
  mood: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  sleep: z.number().min(0).max(24).optional(),
  reflection: optionalString(10000),
  winToday: optionalString(2000),
  lessonLearned: optionalString(2000),
  tomorrowPlan: optionalString(2000),
});
export type CreateJournalInput = z.infer<typeof createJournalSchema>;

export const updateJournalSchema = createJournalSchema.partial();
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;

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

// ── Habit Option ─────────────────────────────────────────────────────────

export const createHabitOptionSchema = z.object({
  type: z.enum(['category', 'priority', 'difficulty']),
  name: nonEmpty(100),
  color: z.string().max(50).optional(),
  xp: z.number().int().min(0).max(10000).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateHabitOptionInput = z.infer<typeof createHabitOptionSchema>;

// ── Settings ─────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  userName: nonEmpty(100).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  weekStart: z.enum(['monday', 'sunday', 'saturday']).optional(),
  language: z.string().max(10).optional(),
  targetCompletion: z.number().int().min(1).max(100).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ── Learning Topic ───────────────────────────────────────────────────────

export const createLearningTopicSchema = z.object({
  name: nonEmpty(100),
  emoji: z.string().max(20).optional(),
  order: z.number().int().min(0).optional(),
});
export type CreateLearningTopicInput = z.infer<typeof createLearningTopicSchema>;

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
