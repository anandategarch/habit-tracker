'use client';

// ── URL ↔ store context sync (Task 71-a, split dari src/app/page.tsx) ────
// Helper murni (VALID_TAB_IDS, isValidCalendarDate, applyUrlToStore,
// buildContextUrl) + hook useUrlContextSync yang memasang efek deep-link,
// sinkronisasi store → URL, dan listener popstate.

import { useEffect, useRef } from 'react';
import { useAppStore, type TabId, type FinanceSubTab, FINANCE_SUB_TABS } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';

// BUGHUNT-OTHER-1 BUG-M14: lookup set for validating the `?tab=` query param.
const VALID_TAB_IDS = new Set<string>([
  'dashboard', 'tracker', 'progress', 'work',
  'finance', 'settings', 'pohon', 'gym',
]);

// ── CONNECTED-APP (Task 46): URL = konteks yang shareable ─────────────────
// Deep-link yang didukung (hanya konteks yang memang layak dibagikan —
// bukan seluruh transient state):
//   ?tab=tracker|progress|work|finance|settings|pohon|gym
//   ?date=yyyy-MM-dd   → tanggal tracker terpilih (bila ≠ hari ini)
//   ?sub=transactions|budgets|… → sub-tab Keuangan (bila ≠ overview)
// Browser Back kini bersejarah: pergantian tab membuat entry history baru
// (pushState) sehingga perjalanan Hari Ini → Tracker → Habit bisa mundur
// alami (dulu replaceState → tombol Back langsung keluar aplikasi).
const URL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** BUGHUNT-47 (47-d #5): ?date= harus tanggal kalender NYATA — regex saja
 *  menerima '9999-99-99'/'2026-02-31' lalu Date.UTC me-roll-over ke tanggal
 *  mustahil di tracker. Validasi komponen UTC balik sama persis. */
function isValidCalendarDate(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Terapkan parameter URL → store (dipakai saat mount awal & popstate).
 * BUGHUNT-47 (47-d #1 — tombol Back "macet"): param konteks yang TIDAK ada
 * di entry history kini me-RESET konteks store (URL = sumber kebenaran saat
 * Back/deep-link). Dulu `?tab=finance` tanpa `?sub=` masih memegang
 * sub-tab lama → efek sinkron pushState BARU saat mundur → entry maju
 * dihancurkan & Back tampak mati. */
function applyUrlToStore() {
  const params = new URLSearchParams(window.location.search);
  const s = useAppStore.getState();
  const tab = params.get('tab');
  const nextTab = tab && VALID_TAB_IDS.has(tab) ? (tab as TabId) : 'dashboard';
  if (nextTab !== s.activeTab) s.setActiveTab(nextTab);
  // ?date= hanya relevan di konteks tracker (47-d #5) — di tab lain param
  // ini justru menempel sebagai konteks basi.
  const date = params.get('date');
  const dateOk = !!date && URL_DATE_RE.test(date) && isValidCalendarDate(date);
  if (nextTab === 'tracker') {
    if (dateOk) {
      if (date !== s.selectedDate) {
        s.setSelectedDate(date);
        if (date.slice(0, 7) !== s.trackerMonth) s.setTrackerMonth(date.slice(0, 7));
      }
      // VERIFY-48 (48-b): entry ?date=X menjanjikan TAMPILAN HARI itu — reset
      // viewMode KE SETIAP popstate/mount bertanggal (dulu hanya saat tanggal
      // berbeda: Back dari tab lain dengan tanggal SAMA masih bisa mendarat di
      // kalender Riwayat yang basi).
      if (s.trackerViewMode !== 'today') s.setTrackerViewMode('today');
    } else if (!dateOk) {
      // Entry tanpa konteks tanggal = hari ini (mencegah tanggal basi menempel
      // saat Back ke entry pra-konteks).
      const today = jakartaDateString();
      if (s.selectedDate !== today) {
        s.setSelectedDate(today);
        if (today.slice(0, 7) !== s.trackerMonth) s.setTrackerMonth(today.slice(0, 7));
      }
      // TASK 60-a #4b (temuan 59-b1 — paritas VERIFY-48): entry TANPA ?date juga
      // menjanjikan TAMPILAN DEFAULT (hari ini), bukan view-mode basi. Semantik
      // cabang ber-date (VERIFY-48 48-b): "entry ?date=X menjanjikan TAMPILAN
      // HARI itu — reset viewMode ke setiap popstate/mount bertanggal"; dulu
      // hanya cabang itu yang me-reset — Back dari tab lain ke entry tracker
      // TANPA ?date (tanggal = hari ini) masih bisa mendarat di kalender
      // Riwayat yang basi. Kedua cabang kini konsisten: URL = sumber kebenaran
      // saat Back/deep-link; view-mode hanya "survive pergantian tab" lewat
      // klik nav (jalur pushState tidak memanggil fungsi ini).
      if (s.trackerViewMode !== 'today') s.setTrackerViewMode('today');
    }
  }
  const sub = params.get('sub');
  if (nextTab === 'finance') {
    if (
      sub &&
      FINANCE_SUB_TABS.has(sub) &&
      sub !== s.financeSubTab
    ) {
      s.setFinanceSubTab(sub as FinanceSubTab);
    } else if (!sub && s.financeSubTab !== 'overview') {
      s.setFinanceSubTab('overview');
    }
  }
}

/** Susun URL konteks untuk state saat ini (tab aktif + konteksnya).
 * BUGHUNT-47 (47-d #6): param tak dikenal (?goal=/?category=/… hasil URL
 * manual) dibersihkan supaya URL tetap kanonik dan tidak menempel abadi
 * di semua pushState berikutnya. */
function buildContextUrl(tab: TabId): URL {
  const url = new URL(window.location.href);
  const known = new Set(['tab', 'date', 'sub']);
  for (const key of Array.from(url.searchParams.keys())) {
    if (!known.has(key)) url.searchParams.delete(key);
  }
  url.searchParams.delete('tab');
  url.searchParams.delete('date');
  url.searchParams.delete('sub');
  if (tab !== 'dashboard') url.searchParams.set('tab', tab);
  const s = useAppStore.getState();
  if (tab === 'tracker' && s.selectedDate !== jakartaDateString()) {
    url.searchParams.set('date', s.selectedDate);
  }
  if (tab === 'finance' && s.financeSubTab !== 'overview') {
    url.searchParams.set('sub', s.financeSubTab);
  }
  return url;
}

/** CONNECTED-APP: pasang efek sinkronisasi URL ↔ store pada shell.
 * Urutan efek PENTING: deep-link mount (applyUrlToStore) harus jalan
 * SEBELUM efek sinkron store → URL, agar kanonikalisasi mount memakai
 * state pasca-deep-link (bukan pra-deep-link). */
export function useUrlContextSync(
  activeTab: TabId,
  selectedDate: string,
  financeSubTab: FinanceSubTab,
) {
  // CONNECTED-APP: deep-link URL saat mount pertama (?tab= + ?date= + ?sub=,
  // validasi ketat — konteks dipulihkan tanpa reload).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    applyUrlToStore();
  }, []);

  // CONNECTED-APP: sinkronisasi store → URL. Pergantian TAB membuat entry
  // history baru (pushState → tombol Back mundur antar tab secara alami);
  // perubahan param konteks saja (tanggal tracker / sub-tab keuangan) memakai
  // replaceState supaya history tidak dibanjiri entry kecil. popstate sudah
  // meng-update store, jadi cabang ini jadi no-op saat Back (URL sama).
  const prevTabRef = useRef<TabId | null>(null);
  // BUGHUNT-47 (47-d #1): popstate tidak boleh mem-push entry history baru —
  // pushState saat mundur menghancurkan riwayat maju & membuat Back tampak
  // mati. Flag ini memaksa replaceState untuk siklus sinkron yang dipicu
  // popstate (dibersihkan setelah efek jalan / macrotask berikutnya).
  const isPopstateRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // VERIFY-48 (48-b): eksekusi PERTAMA efek (mount) menutup mata memakai
    // state render-1 (pra-deep-link, activeTab='dashboard') → replaceState
    // MENGHAPUS entry deep-link asli lalu pushState membuat duplikat —
    // Back dari tab deep-link mendarat di dashboard kosong, bukan keluar app.
    // Mount: applyUrlToStore (efek di atasnya) sudah menyelaraskan store ↔
    // URL; cukup kanonikalisasi IN-PLACE (param sampah dibersihkan tanpa
    // mengganti entry) + catat tab sebagai titik awal riwayat.
    if (prevTabRef.current === null) {
      const mountedTab = useAppStore.getState().activeTab;
      prevTabRef.current = mountedTab;
      const canonical = buildContextUrl(mountedTab);
      if (canonical.search !== window.location.search) {
        window.history.replaceState({ rutinaTab: mountedTab }, '', canonical.toString());
      }
      return;
    }
    const url = buildContextUrl(activeTab);
    const isTabSwitch = prevTabRef.current !== null && prevTabRef.current !== activeTab;
    if (url.search !== window.location.search) {
      if (isTabSwitch && !isPopstateRef.current) {
        window.history.pushState({ rutinaTab: activeTab }, '', url.toString());
      } else {
        window.history.replaceState({ rutinaTab: activeTab }, '', url.toString());
      }
    }
    prevTabRef.current = activeTab;
    isPopstateRef.current = false;
  }, [activeTab, selectedDate, financeSubTab]);

  // CONNECTED-APP: tombol Back browser → pulihkan konteks dari URL ke store
  // (mundur antar tab tanpa reload — dulu Back selalu keluar aplikasi).
  useEffect(() => {
    const onPop = () => {
      isPopstateRef.current = true;
      // BUGHUNT-54 (3-d #5): aksi quick-add yang BELUM terkonsumsi saat user
      // menekan Back = user membatalkan (Back terjadi sebelum chunk tab target
      // termount & efek konsumennya jalan) — bersihkan supaya tab yang
      // dikunjungi manual belakangan tidak mendadak membuka dialog tambah.
      // Bila aksi sudah dikonsumsi nilainya null → clearQuickAdd() no-op.
      useAppStore.getState().clearQuickAdd();
      applyUrlToStore();
      // Guard: bila popstate tidak mengubah store (efek sinkron tidak jalan),
      // flag tetap harus bersih sebelum klik tab berikutnya — jika tidak, klik
      // tab berikutnya akan replaceState (entry history tidak dibuat).
      setTimeout(() => { isPopstateRef.current = false; }, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
