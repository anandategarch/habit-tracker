'use client';

// components/habit-tracker/category-explorer-detail-filters.tsx — pemilih
// bulan (Select) view detail kategori. Bulan GLOBAL (store) — onChange
// diteruskan lewat prop onSelectMonth oleh view induk.
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX identik.

import { Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CategoryDetailFiltersProps {
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
  onSelectMonth: (m: string) => void;
}

export function CategoryDetailFilters({ selectedMonth, monthOptions, onSelectMonth }: CategoryDetailFiltersProps) {
  return (
    /* Month picker */
    <Select value={selectedMonth} onValueChange={onSelectMonth}>
      <SelectTrigger className="w-full sm:w-[180px] h-9">
        <Calendar className="h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {monthOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
