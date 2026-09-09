// components/habit-tracker/goals-helpers.ts — tipe + label + util tab Tujuan.
//
// Fix 6-a FIX-9: badge status/priority menampilkan label Indonesia (bukan
// enum mentah English). Data lama bisa memakai nilai English ("High"/
// "Medium"/"Low") maupun Indonesia ("Tinggi"/"Sedang"/"Rendah" — bentuk
// seed Rutina); keduanya dipetakan dengan fallback ke nilai mentah.

import { jakartaDateString } from '@/lib/timezone';

// ── Tipe (bentuk serialisasi /api/goals) ────────────────────────────────────

export interface GoalMilestone {
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description?: string | null;
  /** 'Tinggi' | 'Sedang' | 'Rendah' (legacy: High/Medium/Low). */
  priority: string;
  /** 'active' | 'completed' | 'cancelled'. */
  status: string;
  /** 'yyyy-MM-dd' (String kolom DB — bukan DateTime). */
  deadline?: string | null;
  milestones?: GoalMilestone[] | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Label Indonesia (fix 6-a FIX-9) ─────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Rendah',
  High: 'Tinggi',
  Medium: 'Sedang',
  Low: 'Rendah',
  Tinggi: 'Tinggi',
  Sedang: 'Sedang',
  Rendah: 'Rendah',
};

/** Label status Indonesia dengan fallback nilai mentah. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Label prioritas Indonesia dengan fallback nilai mentah. */
export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

/** Opsi prioritas untuk form (nilai Indonesia — konsisten dengan seed). */
export const PRIORITY_OPTIONS = ['Tinggi', 'Sedang', 'Rendah'] as const;

// ── Warna badge ─────────────────────────────────────────────────────────────

type PriorityKey = 'tinggi' | 'sedang' | 'rendah';

export function priorityKey(priority: string): PriorityKey {
  const v = priority.toLowerCase();
  if (v === 'high' || priority === 'Tinggi') return 'tinggi';
  if (v === 'low' || priority === 'Rendah') return 'rendah';
  return 'sedang';
}

export const PRIORITY_BADGE_CLASSES: Record<PriorityKey, string> = {
  tinggi: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  sedang: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rendah: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-400',
};

// ── Progres milestone ───────────────────────────────────────────────────────

/** Persen milestone selesai (0..100); goal tanpa milestone: 0 (100 bila selesai). */
export function goalProgress(goal: Goal): number {
  const ms = goal.milestones ?? [];
  if (ms.length === 0) return goal.status === 'completed' ? 100 : 0;
  const done = ms.filter((m) => m.done).length;
  return Math.round((done / ms.length) * 100);
}

/**
 * Status turunan dari milestone (BUG-M16): semua milestone selesai →
 * 'completed'; selama itu status aktif kembali. Status 'cancelled' tidak
 * pernah diubah otomatis (hanya lewat aksi user).
 */
export function nextStatusForMilestones(currentStatus: string, milestones: GoalMilestone[]): string {
  if (currentStatus === 'cancelled') return 'cancelled';
  const allDone = milestones.length > 0 && milestones.every((m) => m.done);
  return allDone ? 'completed' : 'active';
}

// ── Deadline (TZ-safe) ──────────────────────────────────────────────────────

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Format deadline 'yyyy-MM-dd' → 'd MMM yyyy' Indonesia.
 * Fix 6-a FIX-8: Date dibangun dari KOMPONEN YMD (local midnight) — bukan
 * new Date('yyyy-MM-dd') (UTC parse) — lalu dibaca dengan komponen LOCAL,
 * sehingga tidak pernah bergeser -1 hari di browser barat/ timur UTC.
 */
export function formatDeadlineYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Selisih hari deadline terhadap HARI INI Jakarta (fix 6-a FIX-8: konsisten
 * dengan isOverdue — bukan clock lokal browser). Positif = masa depan.
 */
export function daysUntilDeadline(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  const deadlineMs = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = jakartaDateString().split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  return Math.round((deadlineMs - todayMs) / 86_400_000);
}

/** Deadline ≤ 7 hari ke depan (belum lewat). */
export function isDeadlineUrgent(ymd: string): boolean {
  const days = daysUntilDeadline(ymd);
  return Number.isFinite(days) && days >= 0 && days <= 7;
}

/** Deadline sudah terlewat. */
export function isDeadlineOverdue(ymd: string): boolean {
  const days = daysUntilDeadline(ymd);
  return Number.isFinite(days) && days < 0;
}

/** Teks ringkas relatif deadline ("Hari ini", "3 hari lagi", "Terlewat 2 hari"). */
export function deadlineRelativeLabel(ymd: string): string {
  const days = daysUntilDeadline(ymd);
  if (!Number.isFinite(days)) return '';
  if (days === 0) return 'Hari ini';
  if (days > 0) return `${days} hari lagi`;
  return `Terlewat ${Math.abs(days)} hari`;
}
