'use client';

// components/habit-tracker/source-balance.tsx — panel saldo per sumber dana
// + dialog Transfer Antar Sumber (POST /api/finance/transfer).
//
// ONE-CLICK-2 / quickAddAction: FAB "Transfer" (page.tsx) memanggil
// triggerQuickAdd('transfer') lalu openFinanceSubTab('overview') — konsumsi
// terjadi DI SINI (pola consume-and-clear). Guard: tunggu query sources
// selesai; <2 sumber → toast pemandu; ≥2 → buka dialog transfer.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/timezone';
import { formatRupiah, formatNominalInput, amountFromInput } from './finance-types';
import type { FundSource } from './finance-types';
import { cn } from '@/lib/utils';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-Wallet',
};

export function SourceBalance() {
  const queryClient = useQueryClient();
  const quickAddAction = useAppStore(s => s.quickAddAction);
  const clearQuickAdd = useAppStore(s => s.clearQuickAdd);

  const { data: sources = [], isLoading: sourcesLoading, isError } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return (await res.json()).sources ?? [];
    },
    staleTime: 30_000,
  });

  const [transferOpen, setTransferOpen] = useState(false);

  // Konsumsi FAB quick-add 'transfer' (guard: tunggu data sources supaya
  // keputusan ≥2 sumber tidak salah saat cache belum terisi).
  // M6: dialog dibuka via setTimeout(0) TANPA cleanup-cancel. Pola lama
  // (rAF + cleanup cancelAnimationFrame) kalah oleh clearQuickAdd() di bawah:
  // clear memicu re-render → cleanup effect membatalkan rAF sebelum sempat
  // jalan → dialog transfer tidak pernah terbuka dari FAB. Timer di luar
  // cleanup tetap hidup melewati re-render, dan setState dalam callback timer
  // bukan sync-set di body effect.
  useEffect(() => {
    if (quickAddAction !== 'transfer') return;
    if (sourcesLoading) return;
    if (sources.length >= 2) {
      setTimeout(() => setTransferOpen(true), 0);
    } else {
      toast.info('Tambah minimal 2 sumber dana untuk transfer');
    }
    clearQuickAdd();
  }, [quickAddAction, sourcesLoading, sources.length, clearQuickAdd]);

  const totalBalance = useMemo(
    () => sources.reduce((s, src) => s + (src.balance ?? 0), 0),
    [sources]
  );

  const handleOpenTransfer = () => {
    if (sources.length < 2) {
      toast.info('Tambah minimal 2 sumber dana untuk transfer');
      return;
    }
    setTransferOpen(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['finance'] });
  };

  if (isError) {
    return (
      <div className="premium-card rounded-2xl p-4 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Gagal memuat sumber dana</p>
          <p className="text-[11px] text-muted-foreground">Coba lagi dalam sejenak</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
              <Wallet className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold">Sumber Dana</h3>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs shrink-0 anim-press"
            onClick={handleOpenTransfer}
            aria-label="Transfer antar sumber dana"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfer
          </Button>
        </div>

        {sourcesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Belum ada sumber dana — tambahkan lewat tombol “Sumber Dana” di atas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sources.map(src => (
              <li
                key={src.id || src.name}
                className="premium-list-item px-3! py-2.5!"
              >
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 bg-muted/60"
                  aria-hidden="true"
                >
                  {src.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{src.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {SOURCE_TYPE_LABEL[src.type] ?? src.type}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {formatRupiah(src.balance ?? 0)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between px-3 pt-2.5">
              <span className="premium-label">Total Saldo Semua Sumber</span>
              <span className="premium-stat text-sm">{formatRupiah(totalBalance)}</span>
            </li>
          </ul>
        )}
      </div>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        sources={sources}
        onDone={invalidate}
      />
    </>
  );
}

// ── Dialog Transfer ───────────────────────────────────────────────────────

interface TransferFormState {
  fromId: string;
  toId: string;
  amount: string;
  date: string;
  description: string;
  fee: string;
}

function emptyTransferForm(): TransferFormState {
  return { fromId: '', toId: '', amount: '', date: jakartaDateString(), description: '', fee: '' };
}

function TransferDialog({
  open,
  onOpenChange,
  sources,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: FundSource[];
  onDone: () => void;
}) {
  const [form, setForm] = useState<TransferFormState>(emptyTransferForm);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (submitting) return; // guard double-submit: dialog tak bisa ditutup saat in-flight
    if (!next) setForm(emptyTransferForm());
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.fromId || !form.toId) { toast.error('Pilih sumber asal dan tujuan'); return; }
    if (form.fromId === form.toId) { toast.error('Sumber asal dan tujuan tidak boleh sama'); return; }
    const amount = amountFromInput(form.amount);
    if (!amount || amount <= 0) { toast.error('Masukkan jumlah transfer yang valid'); return; }
    const fee = amountFromInput(form.fee);
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSourceId: form.fromId,
          toSourceId: form.toId,
          amount,
          date: form.date,
          description: form.description.trim() || undefined,
          fee: fee > 0 ? fee : undefined,
        }),
      });
      if (res.ok) {
        toast.success(`Transfer ${formatRupiah(amount)} berhasil`);
        setForm(emptyTransferForm());
        onOpenChange(false);
        onDone();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal membuat transfer');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="chip-icon chip-violet h-7 w-7" aria-hidden="true">
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </span>
            Transfer Antar Sumber
          </DialogTitle>
          <DialogDescription>
            Pindahkan saldo antar sumber dana — tercatat sebagai pasangan transaksi transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-from">Dari Sumber</Label>
              <Select value={form.fromId} onValueChange={(v) => setForm(p => ({ ...p, fromId: v }))}>
                <SelectTrigger id="transfer-from" className="h-9">
                  <SelectValue placeholder="Pilih sumber asal" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-to">Ke Sumber</Label>
              <Select value={form.toId} onValueChange={(v) => setForm(p => ({ ...p, toId: v }))}>
                <SelectTrigger id="transfer-to" className="h-9">
                  <SelectValue placeholder="Pilih sumber tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount">Jumlah</Label>
            <Input
              id="transfer-amount"
              inputMode="numeric"
              placeholder="Rp 0"
              value={form.amount}
              onChange={(e) => setForm(p => ({ ...p, amount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))}
              className="h-9 tabular-nums"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-date">Tanggal</Label>
              <Input
                id="transfer-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-fee">Biaya (opsional)</Label>
              <Input
                id="transfer-fee"
                inputMode="numeric"
                placeholder="Rp 0"
                value={form.fee}
                onChange={(e) => setForm(p => ({ ...p, fee: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))}
                className="h-9 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-desc">Keterangan (opsional)</Label>
            <Input
              id="transfer-desc"
              placeholder="mis. Tarik tunai ATM"
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            className={cn('btn-primary-gradient')}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
