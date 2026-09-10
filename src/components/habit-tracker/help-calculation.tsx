'use client';

// components/habit-tracker/help-calculation.tsx — tombol info kecil (i) dengan
// popover penjelasan metrik. section menentukan teks bantuan; label dipakai
// untuk aria-label supaya screen reader membaca konteksnya.

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const HELP_TEXTS: Record<string, string> = {
  proyeksi:
    'Estimasi pengeluaran sampai akhir bulan: rata-rata harian bulan berjalan dikali jumlah hari dalam bulan.',
  'arus kas':
    'Selisih pemasukan dan pengeluaran bulan ini. Nilai positif berarti arus kas sehat.',
  'rata-rata':
    'Rata-rata pengeluaran per hari selama bulan berjalan (hanya hari dengan data).',
  'no-spend':
    'Jumlah hari berturut-turut tanpa pengeluaran apa pun.',
  'target mingguan':
    'Porsi budget bulanan yang dialokasikan per minggu. "Auto" menghitung dari pola belanja asli, "Split" membagi rata.',
};

export function HelpInfoButton({ section, label }: { section: string; label: string }) {
  const [open, setOpen] = useState(false);
  const text = HELP_TEXTS[section.toLowerCase()] ??
    'Metrik ini dihitung dari transaksi tercatat pada periode terpilih.';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label={`Info tentang ${label}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-xs leading-relaxed">
        <p className="font-semibold mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p>{text}</p>
      </PopoverContent>
    </Popover>
  );
}
