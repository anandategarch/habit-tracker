'use client';

// components/habit-tracker/finance-recurring-row.tsx — baris daftar
// transaksi berulang (diekstrak verbatim dari finance-recurring.tsx, Task
// 71-i). Presentasional: avatar emoji kategori + nama + nominal +
// frekuensi + kategori + sumber + tombol Proses/Lihat/Edit/Hapus.

import { Pencil, Play, ReceiptText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRupiah } from './finance-types';
import { tintFromColor, formatDateShort } from '@/lib/finance-helpers';
import { jakartaDateKey } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { RecurringTransaction } from './finance-types';

const FREQ_LABEL: Record<string, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
};

export interface RecurringRowProps {
  rt: RecurringTransaction;
  idx: number;
  sourceName: string | null;
  processingId: string | null;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onProcess: (rt: RecurringTransaction) => void;
  onFocus: (rt: RecurringTransaction) => void;
  onEdit: (rt: RecurringTransaction) => void;
  onDelete: (id: string) => void;
}

export function RecurringRow({
  rt,
  idx,
  sourceName,
  processingId,
  getCategoryMeta,
  onProcess,
  onFocus,
  onEdit,
  onDelete,
}: RecurringRowProps) {
  const meta = getCategoryMeta(rt.category ?? '');
  const income = rt.type === 'income';
  const startDate = rt.startDate ? formatDateShort(jakartaDateKey(new Date(rt.startDate))) : null;
  return (
    <div
      className="premium-list-item px-3! py-2.5!"
      style={{ '--stagger': idx } as CSSProperties}
    >
      <span
        className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
        style={{ backgroundColor: tintFromColor(meta.color) }}
        aria-hidden="true"
      >
        {meta.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium truncate">{rt.name}</p>
          {!rt.isActive && (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
              Nonaktif
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {FREQ_LABEL[rt.frequency] ?? rt.frequency} · {rt.category}
          {sourceName ? ` · ${sourceName}` : ''}
          {startDate ? ` · mulai ${startDate}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            income
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {income ? '+' : '−'}{formatRupiah(rt.amount)}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] px-2 anim-press"
            onClick={() => { void onProcess(rt); }}
            disabled={processingId !== null || !rt.isActive}
            title={rt.isActive ? 'Buat 1 transaksi instance sekarang' : 'Transaksi berulang tidak aktif'}
          >
            <Play className="h-3 w-3" />
            {processingId === rt.id ? 'Memproses…' : 'Proses Sekarang'}
          </Button>
          {/* VERIFY-48 (48-c F6): recurring → transaksinya — arah
              balik (Tagihan Mendatang → sini) sudah ada; baris ini
              dulunya pulau (hanya Proses/Edit/Hapus). */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onFocus(rt)}
            aria-label={`Lihat transaksi kategori ${rt.category} dari ${rt.name}`}
            title={`Lihat transaksi kategori ${rt.category}`}
          >
            <ReceiptText className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(rt)}
            aria-label={`Edit transaksi berulang ${rt.name}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(rt.id)}
            aria-label={`Hapus transaksi berulang ${rt.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
