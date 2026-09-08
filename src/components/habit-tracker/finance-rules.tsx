'use client';

// ── Transaction Rules UI (PHASE2-FINANCE-1) ──────────────────────────────
//
// Self-contained sub-tab: list + Add/Edit/Delete + active toggle for
// auto-categorization rules. Rules execute on POST /api/finance/transactions
// BEFORE the transaction is created — first-match-wins (priority asc, then
// createdAt asc). See lib/finance/rule-engine.ts for the matching logic.
//
// Concept from Firefly III: "if description contains X → set category to Y".

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit3, Trash2, Wand2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  type TransactionRule,
  type CategoryOption,
  type SourceOption,
  FIELD_LABELS,
  OP_LABELS,
  ACTION_FIELD_LABELS,
  type RuleFormState,
  emptyForm,
  formFromRule,
  formToPayload,
} from './finance-rules-helpers';
import { RuleFormDialog, RuleDeleteDialog } from './finance-rules-dialog';

// ── Types ─────────────────────────────────────────────────────────────────

interface FinanceRulesProps {
  /** Returns the category list (any type) for the action value dropdown. */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list (for actionField = 'source'). */
  getActiveSources: () => SourceOption[];
}

// ── Component ────────────────────────────────────────────────────────────

export default function FinanceRules({
  getCategoryList,
  getActiveSources,
}: FinanceRulesProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data fetch ──
  const { data: rules = [], isLoading } = useQuery<TransactionRule[]>({
    queryKey: ['finance', 'rules'],
    queryFn: async () => {
      const res = await fetch('/api/finance/rules');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Mutations ──
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['finance', 'rules'] });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/finance/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal membuat aturan');
      }
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id: string }) => {
      const res = await fetch('/api/finance/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui aturan');
      }
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/rules?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus aturan');
      }
      return res.json();
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (r: TransactionRule) => {
    setEditing(r);
    setForm(formFromRule(r));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Nama aturan wajib diisi');
      return;
    }
    if (!form.conditionValue.trim()) {
      toast.error('Nilai kondisi wajib diisi');
      return;
    }
    if (!form.actionValue.trim()) {
      toast.error('Nilai aksi wajib diisi');
      return;
    }
    if (form.conditionField === 'amount') {
      const n = Number(form.conditionValue);
      if (!Number.isFinite(n)) {
        toast.error('Nilai kondisi untuk amount harus berupa angka');
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateMutation.mutateAsync({ ...payload, id: editing.id });
        toast.success('Aturan diperbarui');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Aturan dibuat');
      }
      invalidate();
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Aturan dihapus');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Aturan otomatis untuk mengategorikan transaksi baru
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Tambah Aturan
        </Button>
      </div>

      {/* Hint */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <Wand2 className="h-3.5 w-3.5 inline mr-1 text-primary" />
        Aturan dievaluasi berdasarkan prioritas (kecil = lebih dulu). Aturan
        pertama yang cocok akan menimpa kategori/sumber transaksi baru.
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        /* PREMIUM-UI: empty state dengan orb ilustrasi + CTA gradient. */
        <div
          className="premium-card premium-card-sheen rounded-2xl premium-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="premium-empty min-h-[20rem] sm:min-h-[22rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Wand2 className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Buat Aturan Otomatis Pertamamu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Contoh: jika deskripsi mengandung &quot;indomaret&quot; → kategori
              &quot;Makanan &amp; Minuman&quot; — transaksi baru otomatis terkategori.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              Buat Aturan Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((r, idx) => (
            /* PREMIUM-UI: bare div .premium-card + chip-soft avatar (Wand2)
               + title + kondisi→aksi meta + status/actions rata kanan —
               pola .premium-list-item ditingkatkan jadi kartu section. */
            <div
              key={r.id}
              className={cn(
                'group premium-card premium-card-sheen rounded-2xl p-4 anim-stagger',
                !r.isActive && 'opacity-60'
              )}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span
                    className="chip-soft chip-soft-teal h-9 w-9 shrink-0"
                    aria-hidden="true"
                  >
                    <Wand2 className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold truncate">{r.name}</h3>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        Prioritas {r.priority ?? 0}
                      </Badge>
                      {!r.isActive && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                    {/* Condition → Action */}
                    <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>
                        Jika <strong className="text-foreground">{FIELD_LABELS[r.conditionField] ?? r.conditionField}</strong>{' '}
                        <em className="text-foreground/80">{OP_LABELS[r.conditionOp] ?? r.conditionOp}</em>{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          &quot;{r.conditionValue}&quot;
                        </code>
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span>
                        Set <strong className="text-foreground">{ACTION_FIELD_LABELS[r.actionField] ?? r.actionField}</strong>{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          &quot;{r.actionValue}&quot;
                        </code>
                      </span>
                    </div>
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
                        invalidate();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : 'Gagal mengubah status'
                        );
                      }
                    }}
                    aria-label="Aktif/nonaktifkan aturan"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Edit aturan ${r.name}`}
                    onClick={() => openEdit(r)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label={`Hapus aturan ${r.name}`}
                    onClick={() => setDeletingId(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── ADD/EDIT DIALOG ─── */}
      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onSubmit={handleSubmit}
        getCategoryList={getCategoryList}
        getActiveSources={getActiveSources}
      />

      {/* ─── DELETE CONFIRMATION ─── */}
      <RuleDeleteDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
