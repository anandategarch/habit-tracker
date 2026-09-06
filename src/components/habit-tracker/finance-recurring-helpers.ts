// ---------------------------------------------------------------------------
// Recurring Transactions — Types, Constants, Helpers, Form State
// Extracted from finance-recurring.tsx during PHASE-B-1.
//
// Pure module: no React, no JSX, no hooks. Safe to import from server
// contexts (e.g. tests) without pulling in the component tree.
//
// Contents:
//  - Types:           RecurringTransaction, CategoryOption, SourceOption
//  - Constant:        DAY_OF_WEEK_NAMES
//  - Display helpers: frequencyLabel, computeNextDue, formatNextRun, toYMD
//  - Form state:      RecurringFormState, emptyForm, formFromRecurring,
//                     formToPayload
//
// NOTE: `FinanceRecurringProps` stays in the component file because it is
// component-specific (prop interface for the default export).
// ---------------------------------------------------------------------------

import { jakartaNowParts } from '@/lib/timezone';

// ── Types ─────────────────────────────────────────────────────────────────

export interface RecurringTransaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  source: string;
  frequency: string;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  interval: number;
  startDate: string;
  endDate: string | null;
  lastRunAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryOption {
  value: string;
  emoji: string;
  color: string;
}

export interface SourceOption {
  id: string;
  name: string;
  emoji: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ── Display helpers ───────────────────────────────────────────────────────

export function frequencyLabel(r: RecurringTransaction): string {
  const interval = r.interval || 1;
  if (r.frequency === 'daily') {
    return interval === 1 ? 'Harian' : `Setiap ${interval} hari`;
  }
  if (r.frequency === 'weekly') {
    const dow = r.dayOfWeek != null ? DAY_OF_WEEK_NAMES[r.dayOfWeek] : '';
    return interval === 1
      ? `Mingguan${dow ? ` (${dow})` : ''}`
      : `Setiap ${interval} minggu${dow ? ` (${dow})` : ''}`;
  }
  // monthly
  const dom = r.dayOfMonth != null ? `tgl ${r.dayOfMonth}` : '';
  return interval === 1
    ? `Bulanan${dom ? ` (${dom})` : ''}`
    : `Setiap ${interval} bulan${dom ? ` (${dom})` : ''}`;
}

/**
 * Compute the next due date (client-side mirror of the server's
 * computeNextDue). Used only for display in the card footer — the server
 * is the source of truth for actual processing.
 */
export function computeNextDue(r: RecurringTransaction): Date | null {
  const now = new Date();
  if (!r.isActive) return null;
  if (r.endDate && new Date(r.endDate).getTime() < now.getTime()) return null;

  const interval = Math.max(1, r.interval || 1);
  const lastRun = r.lastRunAt ? new Date(r.lastRunAt) : null;
  const start = new Date(r.startDate);
  const anchor = lastRun ?? start;

  if (r.frequency === 'daily') {
    return new Date(anchor.getTime() + interval * 86400000);
  }
  if (r.frequency === 'weekly') {
    if (!lastRun) {
      const d = new Date(start);
      const diff = ((r.dayOfWeek ?? 0) - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
    return new Date(lastRun.getTime() + interval * 7 * 86400000);
  }
  // monthly
  const dom = r.dayOfMonth ?? 1;
  const addMonths = (d: Date, m: number) => {
    const nd = new Date(d);
    nd.setDate(1);
    nd.setMonth(nd.getMonth() + m);
    const lastDay = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
    nd.setDate(Math.min(dom, lastDay));
    return nd;
  };
  if (!lastRun) {
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cand = new Date(start.getFullYear(), start.getMonth(), Math.min(dom, lastDay));
    if (cand.getTime() < start.getTime()) return addMonths(cand, interval);
    return cand;
  }
  return addMonths(lastRun, interval);
}

export function formatNextRun(r: RecurringTransaction): string {
  const next = computeNextDue(r);
  if (!next) return r.endDate ? 'Selesai' : '—';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const diffDays = Math.round(
    (nextDay.getTime() - today.getTime()) / 86400000
  );
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: diffDays < -30 || diffDays > 365 ? 'numeric' : undefined,
  }).format(next);
  if (diffDays < 0) return `Jatuh tempo ${dateLabel} (${Math.abs(diffDays)}h lalu)`;
  if (diffDays === 0) return `Hari ini (${dateLabel})`;
  if (diffDays === 1) return `Besok (${dateLabel})`;
  return `${dateLabel} (${diffDays}h lagi)`;
}

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Form state ────────────────────────────────────────────────────────────

export interface RecurringFormState {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  description: string;
  source: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfMonth: string;
  dayOfWeek: string;
  interval: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export function emptyForm(): RecurringFormState {
  const today = toYMD(new Date());
  return {
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    source: 'Kas',
    frequency: 'monthly',
    dayOfMonth: String(jakartaNowParts().day),
    dayOfWeek: '1',
    interval: '1',
    startDate: today,
    endDate: '',
    isActive: true,
  };
}

export function formFromRecurring(r: RecurringTransaction): RecurringFormState {
  return {
    type: r.type as 'income' | 'expense',
    amount: r.amount ? String(r.amount) : '',
    category: r.category,
    description: r.description ?? '',
    source: r.source,
    frequency: r.frequency as 'daily' | 'weekly' | 'monthly',
    dayOfMonth: r.dayOfMonth != null ? String(r.dayOfMonth) : '',
    dayOfWeek: r.dayOfWeek != null ? String(r.dayOfWeek) : '',
    interval: String(r.interval || 1),
    startDate: toYMD(new Date(r.startDate)),
    endDate: r.endDate ? toYMD(new Date(r.endDate)) : '',
    isActive: r.isActive,
  };
}

export function formToPayload(form: RecurringFormState) {
  const amount = parseInt(form.amount.replace(/[^\d]/g, '') || '0', 10);
  const payload: Record<string, unknown> = {
    type: form.type,
    amount,
    category: form.category,
    description: form.description.trim() || null,
    source: form.source,
    frequency: form.frequency,
    interval: parseInt(form.interval || '1', 10) || 1,
    // BUG-PHASE12: previously `new Date(form.startDate + 'T00:00:00')` —
    // this constructs a Date in the BROWSER's local TZ, so a Jakarta user
    // picking "2026-01-15" would send 2026-01-14T17:00:00Z (UTC) and the
    // server's monthly first-run candidate would land on Jan 14 instead of
    // Jan 15. Pin to Jakarta offset (+07:00) for consistency with the
    // savings-goals form (which already does this for `deadline`).
    startDate: new Date(form.startDate + 'T00:00:00+07:00'),
    endDate: form.endDate ? new Date(form.endDate + 'T00:00:00+07:00') : null,
    isActive: form.isActive,
  };
  if (form.frequency === 'monthly') {
    payload.dayOfMonth = parseInt(form.dayOfMonth || '1', 10);
    payload.dayOfWeek = null;
  } else if (form.frequency === 'weekly') {
    payload.dayOfWeek = parseInt(form.dayOfWeek || '0', 10);
    payload.dayOfMonth = null;
  } else {
    payload.dayOfMonth = null;
    payload.dayOfWeek = null;
  }
  return payload;
}
