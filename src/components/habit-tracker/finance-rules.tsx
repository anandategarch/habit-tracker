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

// ── Types ─────────────────────────────────────────────────────────────────

interface TransactionRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditionField: string;
  conditionOp: string;
  conditionValue: string;
  actionField: string;
  actionValue: string;
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

interface FinanceRulesProps {
  /** Returns the category list (any type) for the action value dropdown. */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list (for actionField = 'source'). */
  getActiveSources: () => SourceOption[];
}

// ── Labels ───────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  description: 'Deskripsi',
  source: 'Sumber',
  amount: 'Jumlah',
};

const OP_LABELS: Record<string, string> = {
  contains: 'mengandung',
  equals: 'sama dengan',
  startsWith: 'diawali',
  gt: 'lebih dari',
  lt: 'kurang dari',
};

const ACTION_FIELD_LABELS: Record<string, string> = {
  category: 'Kategori',
  source: 'Sumber',
};

// ── Form state ───────────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  isActive: boolean;
  priority: string;
  conditionField: 'description' | 'source' | 'amount';
  conditionOp: 'contains' | 'equals' | 'startsWith' | 'gt' | 'lt';
  conditionValue: string;
  actionField: 'category' | 'source';
  actionValue: string;
}

function emptyForm(): RuleFormState {
  return {
    name: '',
    isActive: true,
    priority: '0',
    conditionField: 'description',
    conditionOp: 'contains',
    conditionValue: '',
    actionField: 'category',
    actionValue: '',
  };
}

function formFromRule(r: TransactionRule): RuleFormState {
  return {
    name: r.name,
    isActive: r.isActive,
    priority: String(r.priority ?? 0),
    conditionField: r.conditionField as RuleFormState['conditionField'],
    conditionOp: r.conditionOp as RuleFormState['conditionOp'],
    conditionValue: r.conditionValue,
    actionField: r.actionField as RuleFormState['actionField'],
    actionValue: r.actionValue,
  };
}

function formToPayload(form: RuleFormState) {
  return {
    name: form.name.trim(),
    isActive: form.isActive,
    priority: parseInt(form.priority || '0', 10) || 0,
    conditionField: form.conditionField,
    conditionOp: form.conditionOp,
    conditionValue: form.conditionValue.trim(),
    actionField: form.actionField,
    actionValue: form.actionValue,
  };
}

/** Compute the list of valid operators for a given condition field. */
function opsForField(field: string): Array<{ value: string; label: string }> {
  if (field === 'amount') {
    return [
      { value: 'gt', label: 'lebih dari' },
      { value: 'lt', label: 'kurang dari' },
      { value: 'equals', label: 'sama dengan' },
    ];
  }
  return [
    { value: 'contains', label: 'mengandung' },
    { value: 'equals', label: 'sama dengan' },
    { value: 'startsWith', label: 'diawali' },
  ];
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
      alert('Nama aturan wajib diisi');
      return;
    }
    if (!form.conditionValue.trim()) {
      alert('Nilai kondisi wajib diisi');
      return;
    }
    if (!form.actionValue.trim()) {
      alert('Nilai aksi wajib diisi');
      return;
    }
    if (form.conditionField === 'amount') {
      const n = Number(form.conditionValue);
      if (!Number.isFinite(n)) {
        alert('Nilai kondisi untuk amount harus berupa angka');
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateMutation.mutateAsync({ ...payload, id: editing.id });
      } else {
        await createMutation.mutateAsync(payload);
      }
      invalidate();
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
      invalidate();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setDeletingId(null);
    }
  };

  // Action value dropdown options depend on actionField.
  const actionOptions =
    form.actionField === 'source'
      ? getActiveSources().map((s) => ({ value: s.name, label: `${s.emoji} ${s.name}` }))
      : [
          ...getCategoryList('expense').map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
          ...getCategoryList('income').map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
        ];

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
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <Wand2 className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada aturan</p>
            <p className="text-xs mt-1">
              Contoh: jika deskripsi mengandung &quot;indomaret&quot; → kategori
              &quot;Makanan &amp; Minuman&quot;
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rules.map((r) => (
            <div
              key={r.id}
              className={cn(
                'group rounded-2xl bg-card p-4 transition-all hover:shadow-md',
                !r.isActive && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
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
                        alert(
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
          ))}
        </div>
      )}

      {/* ─── ADD/EDIT DIALOG ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Aturan' : 'Tambah Aturan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nama Aturan</Label>
              <Input
                placeholder="Contoh: Indomaret → Makanan"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Kondisi (JIKA)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select
                    value={form.conditionField}
                    onValueChange={(v) => {
                      // Reset op if not valid for the new field
                      const validOps = opsForField(v).map((o) => o.value);
                      setForm((f) => ({
                        ...f,
                        conditionField: v as RuleFormState['conditionField'],
                        conditionOp: (validOps.includes(f.conditionOp)
                          ? f.conditionOp
                          : validOps[0]) as RuleFormState['conditionOp'],
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="description">Deskripsi</SelectItem>
                      <SelectItem value="source">Sumber</SelectItem>
                      <SelectItem value="amount">Jumlah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={form.conditionOp}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        conditionOp: v as RuleFormState['conditionOp'],
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opsForField(form.conditionField).map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  Nilai{' '}
                  {form.conditionField === 'amount'
                    ? '(angka, dalam rupiah)'
                    : '(teks)'}
                </Label>
                <Input
                  type={form.conditionField === 'amount' ? 'number' : 'text'}
                  inputMode={form.conditionField === 'amount' ? 'numeric' : 'text'}
                  placeholder={
                    form.conditionField === 'amount' ? '100000' : 'indomaret'
                  }
                  value={form.conditionValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, conditionValue: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Aksi (MAKA)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Set Field</Label>
                  <Select
                    value={form.actionField}
                    onValueChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        actionField: v as RuleFormState['actionField'],
                        actionValue: '',
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Kategori</SelectItem>
                      <SelectItem value="source">Sumber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Menjadi</Label>
                  <Select
                    value={form.actionValue}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, actionValue: v }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {actionOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Allow custom value via text input as fallback */}
              <Input
                placeholder="atau ketik nilai manual..."
                value={form.actionValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, actionValue: e.target.value }))
                }
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Prioritas</Label>
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value }))
                  }
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Lebih kecil = dievaluasi lebih dulu.
                </p>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, isActive: checked }))
                    }
                  />
                  <Label className="text-xs">Aktif</Label>
                </div>
              </div>
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
            <AlertDialogTitle>Hapus Aturan</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus aturan ini? Transaksi yang sudah dibuat
              tidak akan terpengaruh.
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
