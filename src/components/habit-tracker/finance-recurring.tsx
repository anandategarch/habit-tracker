'use client';

// ── Recurring Transactions UI (PHASE2-FINANCE-1) ─────────────────────────
//
// Self-contained sub-tab: lists all recurring transaction templates and
// provides Add/Edit/Delete + a "Proses Sekarang" button that manually
// triggers the process endpoint to create due transactions.
//
// Concept from Actual Budget + Firefly III: user defines a schedule
// (frequency, interval, dayOfMonth/dayOfWeek) and the system auto-creates
// transactions on that schedule.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit3, Trash2, RefreshCw, Repeat, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { jakartaNowParts } from '@/lib/timezone';
import {
  formatNominalInput,
  formatRupiah,
} from './finance-types';

// ── Types ─────────────────────────────────────────────────────────────────

interface RecurringTransaction {
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

interface CategoryOption {
  value: string;
  emoji: string;
  color: string;
}

interface SourceOption {
  id: string;
  name: string;
  emoji: string;
}

interface FinanceRecurringProps {
  /** Returns the category list for the given type (expense/income). */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list for the source dropdown. */
  getActiveSources: () => SourceOption[];
  /** Resolve emoji + color for a category name (used in card display). */
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DAY_OF_WEEK_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function frequencyLabel(r: RecurringTransaction): string {
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
function computeNextDue(r: RecurringTransaction): Date | null {
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

function formatNextRun(r: RecurringTransaction): string {
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

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Form state ───────────────────────────────────────────────────────────

interface RecurringFormState {
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

function emptyForm(): RecurringFormState {
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

function formFromRecurring(r: RecurringTransaction): RecurringFormState {
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

function formToPayload(form: RecurringFormState) {
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

// ── Component ────────────────────────────────────────────────────────────

export default function FinanceRecurring({
  getCategoryList,
  getActiveSources,
  getCategoryMeta,
}: FinanceRecurringProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [form, setForm] = useState<RecurringFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  // ── Data fetch ──
  const { data: recurring = [], isLoading } = useQuery<RecurringTransaction[]>({
    queryKey: ['finance', 'recurring'],
    queryFn: async () => {
      const res = await fetch('/api/finance/recurring');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'recurring'] });
    // Recurring creates real transactions → invalidate transaction list too.
    queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/finance/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal membuat transaksi berulang');
      }
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id: string }) => {
      const res = await fetch('/api/finance/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui transaksi berulang');
      }
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/recurring?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus transaksi berulang');
      }
      return res.json();
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r);
    setForm(formFromRecurring(r));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.category) {
      alert('Pilih kategori dulu');
      return;
    }
    if (!form.amount || parseInt(form.amount.replace(/[^\d]/g, '') || '0', 10) <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }
    if (form.frequency === 'monthly' && (!form.dayOfMonth || parseInt(form.dayOfMonth, 10) < 1 || parseInt(form.dayOfMonth, 10) > 31)) {
      alert('Hari (tgl) harus 1-31');
      return;
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateMutation.mutateAsync({ ...payload, id: editing.id });
      } else {
        await createMutation.mutateAsync(payload);
      }
      invalidateAll();
      setDialogOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/finance/recurring/process', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses');
      }
      const { processed, skipped, total } = data;
      setProcessResult(
        processed > 0
          ? `✓ ${processed} transaksi dibuat, ${skipped} dilewati (total ${total})`
          : `Tidak ada yang jatuh tempo. ${skipped} dilewati (total ${total})`
      );
      invalidateAll();
    } catch (e) {
      setProcessResult(`✗ ${e instanceof Error ? e.message : 'Terjadi kesalahan'}`);
    } finally {
      setProcessing(false);
    }
  };

  const categoryList = getCategoryList(form.type);
  const sourceList = getActiveSources();

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Transaksi berulang otomatis (mis. sewa, langganan, gaji)
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleProcess}
            disabled={processing || recurring.length === 0}
          >
            <RefreshCw className={cn('h-4 w-4', processing && 'animate-spin')} />
            {processing ? 'Memproses...' : 'Proses Sekarang'}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {/* Process result toast-like banner */}
      {processResult && (
        <div
          className={cn(
            'text-xs rounded-md border px-3 py-2',
            processResult.startsWith('✓')
              ? 'border-success/30 bg-success/10 text-success'
              : processResult.startsWith('✗')
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/40 text-muted-foreground'
          )}
        >
          {processResult}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : recurring.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <Repeat className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada transaksi berulang</p>
            <p className="text-xs mt-1">
              Buat jadwal otomatis untuk tagihan, langganan, atau pemasukan rutin
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {recurring.map((r) => {
            const meta = getCategoryMeta(r.category);
            const isExpense = r.type === 'expense';
            const next = computeNextDue(r);
            const isOverdue =
              next && next.getTime() < Date.now() && r.isActive;
            return (
              <div
                key={r.id}
                className={cn(
                  'group rounded-2xl bg-card p-4 transition-all hover:shadow-md',
                  !r.isActive && 'opacity-60',
                  isOverdue && 'ring-1 ring-warning/40'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${meta.color}22` }}
                    >
                      {meta.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold truncate">
                          {r.description || r.category}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] py-0 px-1.5',
                            isExpense
                              ? 'text-destructive border-destructive/30'
                              : 'text-success border-success/30'
                          )}
                        >
                          {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          <Repeat className="h-2.5 w-2.5" />
                          {frequencyLabel(r)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={cn(
                            'text-sm font-bold',
                            isExpense ? 'text-destructive' : 'text-success'
                          )}
                        >
                          {isExpense ? '-' : '+'}
                          {formatRupiah(r.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {r.category} · {r.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {r.isActive ? formatNextRun(r) : 'Dijeda'}
                        {r.lastRunAt && (
                          <span className="ml-1">
                            · terakhir:{' '}
                            {new Intl.DateTimeFormat('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            }).format(new Date(r.lastRunAt))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={r.isActive}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateMutation.mutateAsync({
                            id: r.id,
                            isActive: checked,
                          });
                          invalidateAll();
                        } catch (e) {
                          alert(
                            e instanceof Error ? e.message : 'Gagal mengubah status'
                          );
                        }
                      }}
                      aria-label="Aktif/nonaktifkan"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(r)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD/EDIT DIALOG ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.type === 'expense' ? 'default' : 'outline'}
                className={cn(
                  form.type === 'expense' &&
                    'bg-destructive hover:bg-destructive text-white'
                )}
                onClick={() =>
                  setForm((f) => ({ ...f, type: 'expense', category: '' }))
                }
              >
                Pengeluaran
              </Button>
              <Button
                type="button"
                variant={form.type === 'income' ? 'default' : 'outline'}
                onClick={() =>
                  setForm((f) => ({ ...f, type: 'income', category: '' }))
                }
              >
                Pemasukan
              </Button>
            </div>

            <div>
              <Label className="text-xs">Jumlah (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: formatNominalInput(e.target.value) }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Sumber Dana</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  {sourceList.map((s) => (
                    <SelectItem key={s.id || s.name} value={s.name}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Deskripsi (opsional)</Label>
              <Input
                placeholder="Contoh: Sewa kos bulanan"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Frekuensi</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      frequency: v as 'daily' | 'weekly' | 'monthly',
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Interval (setiap N)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.interval}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, interval: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {form.frequency === 'monthly' && (
              <div>
                <Label className="text-xs">Tanggal (1-31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dayOfMonth: e.target.value }))
                  }
                  className="mt-1"
                  placeholder="Contoh: 1 untuk tiap tanggal 1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Jika tanggal melebihi hari di bulan tsb, akan dipakai hari
                  terakhir bulan itu.
                </p>
              </div>
            )}

            {form.frequency === 'weekly' && (
              <div>
                <Label className="text-xs">Hari</Label>
                <Select
                  value={form.dayOfWeek}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, dayOfWeek: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OF_WEEK_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mulai</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Berakhir (opsional)</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked }))
                }
              />
              <Label className="text-xs">Aktif</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Menyimpan...' : editing ? 'Perbarui' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi Berulang</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus transaksi berulang ini? Transaksi yang sudah
              dibuat sebelumnya tidak akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive text-white"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
