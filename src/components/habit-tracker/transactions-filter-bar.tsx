'use client';

// ── TransactionsFilterBar ──────────────────────────────────────────────────
// Extracted from finance-transactions.tsx (Task 71-d — split god files).
// Search input + all-time search badge, type segmented control, filter
// chips (category/source), drill-down date chip, and the multi-select
// toggle chip. Presentational only — state (showFilters/multiSelect) stays
// in the parent (needed there for the virtualizer scrollMargin effect);
// every handler/JSX is copied verbatim.

import { Input } from '@/components/ui/input';
import { Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/finance-helpers';
import type { TxFilterState } from './use-transactions-focus';

// PREMIUM-UI ("Rutina Aurora"): opsi filter tipe transaksi untuk segmented
// control premium (menggantikan tombol chip merah/hijau generik). Label &
// value dipetakan 1:1 ke txFilter.type — logika onFilterChange tidak berubah.
// FIX-AUDIT-23 (#1): panah arah (↑/↓) dipisah ke field `arrow` sendiri —
// di layar <400px panah disembunyikan (aria-hidden, dekoratif) supaya 3 item
// muat di 320px. Teks label & value SAMA persis — murni presentasi.
const TYPE_OPTIONS = [
  { value: 'all', label: 'Semua', arrow: '' },
  { value: 'income', label: 'Pemasukan', arrow: '↑' },
  { value: 'expense', label: 'Pengeluaran', arrow: '↓' },
] as const;

interface TransactionsFilterBarProps {
  txFilter: TxFilterState;
  onFilterChange: (filter: TxFilterState) => void;
  /** Jumlah transaksi yang lolos filter client — badge hasil pencarian. */
  filteredCount: number;
  /** Jumlah hasil mentah server — indikator truncation (batas 500). */
  rawCount: number;
  /** CONNECTED-APP — filter tanggal aktif dari drill-down (heatmap / hari ini). */
  focusDate?: string | null;
  /** Lepas chip filter tanggal (kembali ke seluruh bulan). */
  onClearFocusDate?: () => void;
  /** Panel filter kategori/sumber terbuka? (state di parent — dipakai efek
   *  pengukuran scrollMargin virtualizer). */
  showFilters: boolean;
  onToggleShowFilters: () => void;
  multiSelect: boolean;
  /** Toggle mode multi-select (logika clear-seleksi-saat-exit di parent). */
  onToggleMultiSelect: () => void;
  /** selectedTxIds.size — label chip "N dipilih". */
  selectedCount: number;
  getCategoryList: (type: string) => { value: string; emoji: string; color: string }[];
  getActiveSources: () => { id: string; name: string; emoji: string; order: number }[];
}

export function TransactionsFilterBar({
  txFilter,
  onFilterChange,
  filteredCount,
  rawCount,
  focusDate,
  onClearFocusDate,
  showFilters,
  onToggleShowFilters,
  multiSelect,
  onToggleMultiSelect,
  selectedCount,
  getCategoryList,
  getActiveSources,
}: TransactionsFilterBarProps) {
  return (
    <>
      {/* ── Search Bar ────────────────────────────────────────── */}
      {/* 61-g (audit 61-a P2): tombol X icon-only kini ber-aria-label —
          kembarannya di badge hasil pencarian di bawah sudah memilikinya. */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari transaksi di semua periode..."
          value={txFilter.search}
          onChange={e => onFilterChange({ ...txFilter, search: e.target.value })}
          className="pl-9 h-10 text-sm rounded-xl bg-card border-border"
        />
        {txFilter.search && (
          <button
            onClick={() => onFilterChange({ ...txFilter, search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* FEAT-SEARCH-ALLTIME: Badge shown when search is active. Tells the
          user the search spans all periods (not just the selected month)
          and shows result count. Provides a quick clear button. */}
      {txFilter.search.trim() && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
          <Search className="h-3 w-3 shrink-0" />
          <span className="flex-1">
            Mencari di <strong>semua periode</strong> — {filteredCount} transaksi ditemukan
            {/* BUGHUNT-54 (3-a #9): API membatasi 500 hasil — bila hasil mentah
                tepat 500, tampilkan penanda kemungkinan terpotong. */}
            {rawCount === 500 && ' · 500+ kemungkinan terpotong'}
          </span>
          <button
            onClick={() => onFilterChange({ ...txFilter, search: '' })}
            className="shrink-0 hover:bg-primary/20 rounded px-1.5 py-0.5 transition-colors"
            aria-label="Hapus pencarian"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Filter: segmented control tipe + chips util ──────────── */}
      {/* PREMIUM-UI: toggle Semua/Pemasukan/Pengeluaran kini memakai
          .premium-segment (pill gradien aktif per item, data-active attr).
          Logika onFilterChange/txFilter.type TIDAK berubah. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="premium-segment w-full sm:w-auto min-w-0 overflow-x-auto scrollbar-hide"
          role="group"
          aria-label="Filter tipe transaksi"
        >
          {TYPE_OPTIONS.map((opt) => {
            const isActive = txFilter.type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className="premium-segment-item relative h-9 flex-1 min-w-0 whitespace-nowrap cursor-pointer"
                data-active={isActive ? 'true' : 'false'}
                aria-pressed={isActive}
                onClick={() => onFilterChange({ ...txFilter, type: opt.value })}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-full animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 55%, #2dd4bf))',
                      boxShadow:
                        '0 2px 8px -2px color-mix(in oklch, var(--primary) 40%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
                    }}
                  />
                )}
                {opt.arrow && (
                  <span aria-hidden="true" className="hidden min-[400px]:inline">
                    {opt.arrow}&nbsp;
                  </span>
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
        <button
          className="tx-chip tx-chip-inactive flex items-center gap-1"
          onClick={onToggleShowFilters}
        >
          Filter
          <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
        </button>
        {/* CONNECTED-APP — chip tanggal drill-down (heatmap / "hari ini"):
            tampil hanya bila ada, bisa dilepas untuk kembali ke seluruh bulan. */}
        {focusDate && (
          <button
            type="button"
            className="tx-chip tx-chip-active flex items-center gap-1"
            onClick={() => onClearFocusDate?.()}
            aria-label={`Hapus filter tanggal ${focusDate}`}
          >
            {formatDateShort(focusDate)}
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        <button
          className={cn(
            'tx-chip',
            multiSelect ? 'tx-chip-active' : 'tx-chip-inactive'
          )}
          onClick={onToggleMultiSelect}
        >
          {multiSelect ? `${selectedCount} dipilih` : 'Pilih'}
        </button>
      </div>

      {/* ── Expanded Filters (category + source) ───────────────── */}
      {showFilters && (
        <div className="space-y-2 p-3 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <span className="text-xs text-muted-foreground shrink-0">Kategori:</span>
            <button
              className={cn('tx-chip', txFilter.category === 'all' ? 'tx-chip-active' : 'tx-chip-inactive')}
              onClick={() => onFilterChange({ ...txFilter, category: 'all' })}
            >
              Semua
            </button>
            {getCategoryList('expense').map(c => (
              <button
                key={c.value}
                className={cn('tx-chip', txFilter.category === c.value ? 'tx-chip-active' : 'tx-chip-inactive')}
                onClick={() => onFilterChange({ ...txFilter, category: c.value })}
              >
                {c.emoji} {c.value}
              </button>
            ))}
            {getCategoryList('income').map(c => (
              <button
                key={c.value}
                className={cn('tx-chip', txFilter.category === c.value ? 'tx-chip-active' : 'tx-chip-inactive')}
                onClick={() => onFilterChange({ ...txFilter, category: c.value })}
              >
                {c.emoji} {c.value}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <span className="text-xs text-muted-foreground shrink-0">Sumber:</span>
            <button
              className={cn('tx-chip', txFilter.source === 'all' ? 'tx-chip-active' : 'tx-chip-inactive')}
              onClick={() => onFilterChange({ ...txFilter, source: 'all' })}
            >
              Semua
            </button>
            {getActiveSources().map(s => (
              <button
                key={s.id || s.name}
                className={cn('tx-chip', txFilter.source === s.name ? 'tx-chip-active' : 'tx-chip-inactive')}
                onClick={() => onFilterChange({ ...txFilter, source: s.name })}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
