'use client';

// ── useTransactionsFocus ───────────────────────────────────────────────────
// Extracted from finance.tsx (Task 71-d — split god files).
//
// Owns the Transactions sub-tab filter state (txFilter + drill-down date
// chip) and the consumption of the GLOBAL finance focus (FinanceFocus).
// Behavior is copied verbatim from finance.tsx — see inline comments
// (ONE-CLICK-3/4, VERIFY-48 48-b). Efek reset seleksi stale (BUGFIX POST-1
// #4 / BUGHUNT-47 / BUGHUNT-54) tetap di komponen finance.tsx.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore, type FinanceFocus } from '@/store/app-store';
import type { FundSource } from './finance-types';

/** Semantik filter transaksi (persis finance.tsx lama): category/source
 *  adalah NAMA string (bukan id — sourceId drill-down di-resolve ke nama
 *  di applyFinanceFocus), type 'all' | 'income' | 'expense', search teks
 *  bebas (di-debounce di useTransactionsQuery). */
export interface TxFilterState {
  type: string;
  category: string;
  source: string;
  search: string;
}

/** Nilai default txFilter — dipakai reset saat ganti sub-tab (LOW-i) dan
 *  inisialisasi state (objek baru tiap pemanggilan, sama seperti inline
 *  object literal lama). */
export function defaultTxFilter(): TxFilterState {
  return { type: 'all', category: 'all', source: 'all', search: '' };
}

export interface UseTransactionsFocusParams {
  /** Daftar sumber dana aktif (hasil query ['finance','sources'] di
   *  finance.tsx) — dipakai applyFinanceFocus untuk resolve sourceId →
   *  nama (semantik txFilter.source). */
  sources: FundSource[];
  /** isLoading query sources — konsumsi fokus bersourceId ditunda sampai
   *  query selesai (VERIFY-48 48-b, lihat efek konsumsi di bawah). */
  sourcesLoading: boolean;
}

export function useTransactionsFocus({
  sources,
  sourcesLoading,
}: UseTransactionsFocusParams) {

  // Filter states (declared early because useQuery depends on txFilter)
  const [txFilter, setTxFilter] = useState<TxFilterState>(defaultTxFilter);
  // CONNECTED-APP: filter tanggal dari drill-down (heatmap hari tertentu /
  // "pengeluaran hari ini") — client-side, ditampilkan sebagai chip yang bisa
  // dilepas di sub-tab Transaksi.
  const [txFocusDate, setTxFocusDate] = useState<string | null>(null);

  // ONE-CLICK-4: consume the global finance focus (set by openFinanceFocus
  // anywhere in the app — dashboard cards, budget cards, daily recap…).
  // Applies the requested transactions filter, then clears the ephemeral
  // focus (same consume-and-clear pattern as quickAddAction). Category is
  // a NAME string, matching txFilter.category semantics.
  const financeFocus = useAppStore(s => s.financeFocus);
  const clearFinanceFocus = useAppStore(s => s.clearFinanceFocus);
  // Latest-ref untuk sources — diisi oleh effect SETELAH query sumber dinyatakan
  // di finance.tsx (props hook ini). applyFinanceFocus harus identitasnya
  // stabil (pola latest-ref), jadi resolve sourceId lewat ref.
  const sourcesRef = useRef<FundSource[]>([]);
  const applyFinanceFocus = useCallback((focus: FinanceFocus) => {
    setTxFilter(prev => ({
      ...prev,
      // CONNECTED-APP: drill-down kini membawa type + sumber + tanggal:
      //  * txType ('expense' untuk "pengeluaran hari ini", dst.)
      //  * sourceId → resolve nama (semantik txFilter.source)
      //  * date → filter tanggal harian (chip di sub-tab Transaksi)
      type: focus.txType ?? 'all',
      source: focus.sourceId
        ? (sourcesRef.current.find(s => s.id === focus.sourceId)?.name ?? 'all')
        : 'all',
      search: '',
      category: focus.category ?? 'all',
    }));
    setTxFocusDate(focus.date ?? null);
    if (focus.date) {
      // Sinkronkan bulan supaya transaksi tanggal itu benar-benar termuat
      // (daftar transaksi dibatasi selectedMonth). Action store diakses
      // via getState() (sama seperti pembacaan .selectedMonth di baris
      // atas) supaya callback ini benar-benar bebas dependency reaktif —
      // identitasnya stabil selamanya (pola latest-ref).
      const m = focus.date.slice(0, 7);
      const state = useAppStore.getState();
      if (m !== state.selectedMonth) state.setSelectedMonth(m);
    }
  }, []);
  // Stable latest-ref: applyFinanceFocus has empty deps (never changes
  // identity), so the ref is initialized once and never reassigned.
  const applyFocusRef = useRef(applyFinanceFocus);

  // Sinkronkan latest-ref sumber untuk applyFinanceFocus (assignment di sini —
  // setelah `sources` props hook diterima dari finance.tsx).
  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  // Konsumsi fokus global (dipindah ke sini supaya sourcesLoading sudah
  // terdeklarasi — VERIFY-48 48-b latent): focus bersourceId butuh data
  // sources untuk resolve nama (sourcesRef kosong saat mount dingin →
  // filter sumber diam-diam jatuh). Tunda konsumsi sampai query selesai —
  // pola yang sama dengan konsumsi quick-add 'transfer' di SourceBalance.
  useEffect(() => {
    if (financeFocus) {
      if (financeFocus.sourceId && sourcesLoading) return;
      applyFocusRef.current(financeFocus);
      clearFinanceFocus();
    }
  }, [financeFocus, clearFinanceFocus, sourcesLoading]);

  // (Catatan Task 71-d: dua efek RESET — selectedTxIds di-nol-kan saat ganti
  // bulan (BUGFIX POST-1 #4 + BUGHUNT-47, termasuk reset chip tanggal drill-
  // down saat bulan berganti) dan saat filter/tanggal fokus berganti
  // (BUGHUNT-54 3-a #3) — tetap di komponen finance.tsx, persis seperti
  // sebelum pemisahan: efek itu memerlukan selectedMonth (store) + setter
  // selectedTxIds dari useFinanceMutations.)

  return { txFilter, setTxFilter, txFocusDate, setTxFocusDate };
}
