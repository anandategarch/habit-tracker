// Helper savings-goal: deadline YMD → Date tengah malam Jakarta + serialisasi.
import { isValidYMD } from '@/lib/timezone';
import { asString, badRequest } from '@/app/api/_lib/api-utils';
import type { SavingsGoal as SavingsRow } from '@prisma/client';

/** YMD → Date tengah malam Jakarta (konvensi penyimpanan deadline). */
export function jakartaMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
}

export function serializeSavings(goal: SavingsRow) {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    deadline: goal.deadline ? goal.deadline.toISOString() : null,
    completedAt: goal.completedAt ? goal.completedAt.toISOString() : null,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

/** Validasi deadline dari body → Date | null (null = kosongkan). */
export function validateDeadlineDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const s = asString(v);
  if (s === null || !isValidYMD(s)) {
    throw badRequest('Format deadline tidak valid (yyyy-MM-dd)');
  }
  return jakartaMidnight(s);
}
