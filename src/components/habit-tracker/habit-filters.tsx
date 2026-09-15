'use client';

// components/habit-tracker/habit-filters.tsx — bar pencarian + filter habit
// (pencarian nama/emoji, segmen kategori, segmen status aktif/dijeda/arsip).

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { HabitOptionRow } from '@/hooks/use-habit-options';

export interface FiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  categories: HabitOptionRow[];
}

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'active', label: 'Aktif' },
  { id: 'paused', label: 'Dijeda' },
  // Task 36 — tabir kemenangan: lihat habit yang sudah diwisuda (🎓).
  { id: 'graduated', label: 'Lulus' },
  { id: 'archived', label: 'Arsip' },
];

export function FiltersBar({
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  categories,
}: FiltersBarProps) {
  return (
    <div className="space-y-2.5">
      {/* Pencarian */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari habit (nama / emoji)..."
          className="rounded-xl h-9 pl-9 pr-9"
          aria-label="Cari habit"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Hapus pencarian"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md p-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Segmen kategori (Semua + label kategori) — sembunyikan saat tak ada kategori agar tidak ada chip "Semua" yatim */}
      {categories.length > 0 && (
        <div
          className="premium-segment flex-wrap"
          role="group"
          aria-label="Filter kategori habit"
        >
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          data-active={categoryFilter === 'all'}
          aria-pressed={categoryFilter === 'all'}
          className="premium-segment-item"
        >
          Semua
        </button>
        {categories.map((c) => {
          const active = categoryFilter === c.label;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(active ? 'all' : c.label)}
              data-active={active}
              aria-pressed={active}
              className="premium-segment-item inline-flex items-center gap-1.5"
            >
              {c.color && (
                <span
                  className={cn('h-2 w-2 rounded-full', active && 'ring-1 ring-white/60')}
                  style={{ backgroundColor: c.color }}
                  aria-hidden="true"
                />
              )}
              {c.label}
            </button>
          );
        })}
        </div>
      )}

      {/* Segmen status (aktif / dijeda / arsip) */}
      <div
        className="premium-segment"
        role="group"
        aria-label="Filter status habit"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(active ? 'all' : opt.id)}
              data-active={active}
              aria-pressed={active}
              className="premium-segment-item"
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
