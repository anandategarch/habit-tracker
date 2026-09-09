'use client';

// components/habit-tracker/finance-rules.tsx — sub-tab "Aturan": mesin
// kategorisasi otomatis transaksi (Firefly III inspired).
//
// - Daftar rules (premium-list-item): "kata kunci → kategori (+ sumber)" —
//   transaksi baru yang deskripsinya memuat kata kunci otomatis dikategorikan.
// - Dialog tambah/edit: kata kunci, tipe kategori (segment Pengeluaran/
//   Pemasukan → daftar Select mengikuti), kategori, sumber (opsional).
// - Hapus: AlertDialog konfirmasi.
// - Semua notifikasi toast Indonesia (bukan alert()) + guard double-submit
//   (submitting + tombol disabled) + FIX-1/6-b (reset state di finally,
//   onOpenChange di-guard submitting).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { TransactionRule } from './finance-types';

interface FinanceRulesProps {
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
}

interface RuleFormState {
  id: string | null;
  keyword: string;
  category: string;
  categoryType: string;
  sourceId: string;
}

function emptyRuleForm(): RuleFormState {
  return { id: null, keyword: '', category: '', categoryType: 'expense', sourceId: '' };
}

export default function FinanceRules({ getCategoryList, getActiveSources }: FinanceRulesProps) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RuleFormState>(emptyRuleForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rulesQuery = useQuery<TransactionRule[]>({
    queryKey: ['finance', 'rules'],
    queryFn: async () => {
      const res = await fetch('/api/finance/rules');
      if (!res.ok) throw new Error('Gagal memuat aturan');
      return (await res.json()).rules ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });

  const rules = useMemo(
    () => (Array.isArray(rulesQuery.data) ? rulesQuery.data : []),
    [rulesQuery.data]
  );

  // Meta kategori (emoji) dicari dari daftar kategori expense lalu income.
  const categoryMeta = useMemo(() => {
    const map = new Map<string, { emoji: string }>();
    for (const c of getCategoryList('expense')) map.set(c.value, { emoji: c.emoji });
    for (const c of getCategoryList('income')) if (!map.has(c.value)) map.set(c.value, { emoji: c.emoji });
    return map;
  }, [getCategoryList]);

  const sourceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of getActiveSources()) map.set(s.id, s.name);
    return map;
  }, [getActiveSources]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'rules'] });
  };

  // ── Dialog helpers ──────────────────────────────────────────────────────
  const openNew = () => {
    setForm(emptyRuleForm());
    setFormOpen(true);
  };

  const openEdit = (rule: TransactionRule) => {
    const incomeCats = new Set(getCategoryList('income').map((c) => c.value));
    setForm({
      id: rule.id,
      keyword: rule.keyword ?? '',
      category: rule.category ?? '',
      categoryType: incomeCats.has(rule.category) ? 'income' : 'expense',
      sourceId: rule.sourceId ?? '',
    });
    setFormOpen(true);
  };

  // FIX-1/6-b: dialog tak bisa ditutup saat submit in-flight.
  const handleFormOpenChange = (next: boolean) => {
    if (submitting) return;
    setFormOpen(next);
  };

  const handleSubmit = async () => {
    if (submitting) return; // guard double-submit
    if (!form.keyword.trim()) { toast.error('Masukkan kata kunci aturan'); return; }
    if (!form.category) { toast.error('Pilih kategori tujuan'); return; }

    const payload = {
      keyword: form.keyword.trim(),
      category: form.category,
      sourceId: form.sourceId || null,
    };

    setSubmitting(true);
    try {
      const res = form.id
        ? await fetch(`/api/finance/rules/${form.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/finance/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        toast.success(form.id ? 'Aturan berhasil diupdate' : 'Aturan berhasil ditambahkan');
        setFormOpen(false);
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || (form.id ? 'Gagal mengupdate aturan' : 'Gagal menambahkan aturan'));
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      // FIX-1/6-b: reset SELALU di finally.
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    try {
      const res = await fetch(`/api/finance/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Aturan berhasil dihapus');
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal menghapus aturan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setDeletingId(null);
    }
  };

  const deleting = rules.find((r) => r.id === deletingId) ?? null;
  const categoryOptions = getCategoryList(form.categoryType === 'income' ? 'income' : 'expense');
  const sourceOptions = getActiveSources();

  // ── Error state ──────────────────────────────────────────────────────────
  if (rulesQuery.isError) {
    return (
      <div className="premium-card rounded-2xl mt-4">
        <div className="premium-empty min-h-[16rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Gagal memuat aturan</p>
          <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
          <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={() => { void rulesQuery.refetch(); }}>
            <RefreshCw className="h-3 w-3" /> Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32 rounded" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="chip-icon chip-violet h-7 w-7" aria-hidden="true">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          Aturan Otomatis
        </h3>
        <Button size="sm" className="h-9 btn-primary-gradient anim-press shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> Aturan Baru
        </Button>
      </div>

      {/* Daftar rules */}
      {rules.length === 0 ? (
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Wand2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada aturan</p>
            <p className="text-xs text-muted-foreground">
              Buat aturan supaya transaksi baru otomatis terkategorikan dari
              kata kuncinya.
            </p>
            <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Buat Aturan Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="premium-card premium-card-sheen rounded-2xl p-2 sm:p-3 space-y-1.5 anim-stagger">
          {rules.map((rule, idx) => {
            const meta = categoryMeta.get(rule.category);
            const sourceName = rule.sourceId ? (sourceNameById.get(rule.sourceId) ?? null) : null;
            return (
              <div
                key={rule.id}
                className="premium-list-item px-3! py-2.5!"
                style={{ '--stagger': idx } as CSSProperties}
              >
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 bg-muted/60"
                  aria-hidden="true"
                >
                  🔍
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium truncate max-w-[10rem]">
                    “{rule.keyword}”
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span aria-hidden="true">{meta?.emoji ?? '🏷️'}</span>
                    <span className="text-sm truncate max-w-[10rem]">{rule.category}</span>
                  </span>
                  {sourceName && (
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 truncate max-w-[8rem]">
                      {sourceName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(rule)}
                    aria-label={`Edit aturan ${rule.keyword}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(rule.id)}
                    aria-label={`Hapus aturan ${rule.keyword}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog tambah/edit aturan ── */}
      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={cn('chip-icon h-7 w-7', form.id ? 'chip-amber' : 'chip-violet')}
                aria-hidden="true"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </span>
              {form.id ? 'Edit Aturan' : 'Aturan Baru'}
            </DialogTitle>
            <DialogDescription>
              Transaksi baru yang deskripsinya memuat kata kunci akan otomatis
              masuk ke kategori (dan sumber) ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-keyword">Kata Kunci</Label>
              <Input
                id="rule-keyword"
                placeholder="mis. kopi"
                value={form.keyword}
                onChange={(e) => setForm((prev) => ({ ...prev, keyword: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>

            {/* Tipe kategori — menentukan daftar Select di bawah */}
            <div className="premium-segment w-full" role="group" aria-label="Tipe kategori tujuan">
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={form.categoryType !== 'income' ? 'true' : 'false'}
                aria-pressed={form.categoryType !== 'income'}
                onClick={() => setForm((prev) => ({ ...prev, categoryType: 'expense', category: '' }))}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={form.categoryType === 'income' ? 'true' : 'false'}
                aria-pressed={form.categoryType === 'income'}
                onClick={() => setForm((prev) => ({ ...prev, categoryType: 'income', category: '' }))}
              >
                Pemasukan
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-category">Kategori Tujuan</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
              >
                <SelectTrigger id="rule-category" className="h-9">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-source">Sumber Dana (opsional)</Label>
              <Select
                value={form.sourceId || 'none'}
                onValueChange={(v) => setForm((prev) => ({ ...prev, sourceId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="rule-source" className="h-9">
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Semua sumber</SelectItem>
                  {sourceOptions.map((s) => (
                    <SelectItem key={s.id || s.name} value={s.id || s.name}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleFormOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button className="btn-primary-gradient" onClick={() => { void handleSubmit(); }} disabled={submitting}>
              {submitting ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi hapus aturan ── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Aturan?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Aturan kata kunci <strong>“{deleting?.keyword}”</strong> akan
              dihapus. Transaksi yang sudah terkategorikan tidak berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
