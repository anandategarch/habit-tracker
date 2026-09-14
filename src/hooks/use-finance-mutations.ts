'use client';

// ── useFinanceMutations ───────────────────────────────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
//
// Owns all dialog open-state + form state + CRUD handlers for the Finance
// page (Transaction CRUD, Split helpers, Budget CRUD, Category CRUD, Source
// CRUD, Bulk Delete). The main Finance component consumes this hook's return
// value and passes the relevant slices to the extracted dialog components.
//
// Design notes:
//  - The hook owns the form/dialog state because every handler needs to
//    mutate it (close dialog on success, clear form, etc.). Hoisting state
//    to the parent would require passing ~30 setters back into the hook.
//  - `getActiveSources` is passed in because it depends on the `sources`
//    useQuery in the main component (data-fetching stays there per the
//    split spec).
//  - `invalidateFinance` is created inside the hook (it depends on
//    queryClient + useAppStore.triggerRefresh, both of which the hook can
//    call directly).

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString, jakartaNowParts } from '@/lib/timezone';
import { smallPop } from '@/lib/confetti';
import type {
 Transaction,
 BudgetItem,
 FinanceCategory,
 FundSource,
 TransactionRule,
} from '@/components/habit-tracker/finance-types';
import {
 formatNominalInput,
 parseNominalInput,
 formatRupiah,
 parseTags,
} from '@/components/habit-tracker/finance-types';

export interface SplitRow {
 category: string;
 amount: string;
}

export interface TxFormState {
 type: string;
 amount: string;
 category: string;
 description: string;
 date: string;
 time: string;
 notes: string;
 source: string;
 // PHASE4-POLISH: tags stored as a string[] in the form. Serialized to a
 // JSON array string by the API before DB storage. The form keeps the
 // parsed array form so the chip input UI can add/remove tags directly.
 tags: string[];
}

export interface BudgetFormState {
 category: string;
 amount: string;
 period: string;
}

export interface CatFormState {
 type: string;
 name: string;
 emoji: string;
 color: string;
 trackLastDone: boolean;
}

export interface SourceFormState {
 name: string;
 emoji: string;
 balance: number;
}

export interface UseFinanceMutationsParams {
 /** Returns the active sources list — used by handleSaveBalance to detect
  *  no-op edits. Passed in because it depends on the `sources` useQuery
  *  which lives in the main Finance component. */
 getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
}

export function useFinanceMutations({ getActiveSources }: UseFinanceMutationsParams) {
 const queryClient = useQueryClient();
 const triggerRefresh = useAppStore(s => s.triggerRefresh);
 // M5: bulan terpilih global — dikirim di POST/PUT budget supaya budget
 // mengikuti bulan yang sedang dilihat (bukan selalu bulan berjalan).
 const selectedMonth = useAppStore(s => s.selectedMonth);
 // BUGHUNT-ROUND2 FAB-1: FAB quick-add trigger — opens the add-transaction
 // dialog (expense/income mode) after the Finance tab mounts. Cleared on
 // consumption so a stale action can't re-fire later.
 const quickAddAction = useAppStore(s => s.quickAddAction);
 const clearQuickAdd = useAppStore(s => s.clearQuickAdd);

 // ── Dialog states ──
 const [txDialogOpen, setTxDialogOpen] = useState(false);
 const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [catDialogOpen, setCatDialogOpen] = useState(false);
 const [catFormOpen, setCatFormOpen] = useState(false);
 const [editingTx, setEditingTx] = useState<Transaction | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [editingCat, setEditingCat] = useState<FinanceCategory | null>(null);
 const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
 const [sourceFormOpen, setSourceFormOpen] = useState(false);
 const [editingSource, setEditingSource] = useState<FundSource | null>(null);
 const [sourceForm, setSourceForm] = useState<SourceFormState>({ name: '', emoji: '💵', balance: 0 });
 const [balanceEditId, setBalanceEditId] = useState<string | null>(null);
 const [balanceEditValue, setBalanceEditValue] = useState('');
 const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
 const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
 const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
 const [budgetEditOpen, setBudgetEditOpen] = useState(false);
 const [deletingSource, setDeletingSource] = useState<FundSource | null>(null);

 // ── Form states ──
 // BUG-FIN-1 (Task 30): initial state 'Kas' → '' — state awal hanya
 // placeholder; nilai riil selalu di-set openNewTx (prefill sumber aktif)
 // atau openEditTx. 'Kas' hardcoded berisiko 400 bila tidak ada sumber itu.
 const [txForm, setTxForm] = useState<TxFormState>({ type: 'expense', amount: '', category: '', description: '', date: '', time: '', notes: '', source: '', tags: [] });
 // Split-mode state. Only used when adding a new transaction (not editing —
 // split children are standalone transactions and are edited individually
 // via the regular single-category form).
 const [splitMode, setSplitMode] = useState(false);
 const [splitRows, setSplitRows] = useState<Array<SplitRow>>([
   { category: '', amount: '' },
   { category: '', amount: '' },
 ]);
 // Calculator dialog state
 const [calcOpen, setCalcOpen] = useState(false);
 const [budgetForm, setBudgetForm] = useState<BudgetFormState>({ category: '', amount: '', period: 'monthly' });
 const [catForm, setCatForm] = useState<CatFormState>({ type: 'expense', name: '', emoji: '📦', color: '#78716c', trackLastDone: false });
 const [submitting, setSubmitting] = useState(false);
 // ANIM-2 / Feature 3: MoneyParticles trigger key. Increment to fire a
 // burst of floating 💰 particles when an income transaction is added.
 // Starts at 0 — the MoneyParticles component ignores the initial value.
 const [moneyParticlesKey, setMoneyParticlesKey] = useState(0);
 // BUG-5 fix: double-submit guard. Prevents concurrent submissions when the
 // user double-clicks the Save/Simpan button (especially in split mode where
 // N expense rows + a balance update are created atomically). Set to true at
 // the start of handleSubmitTx, reset in each finally block.
 const submitGuard = useRef(false);

 // ── Helper: invalidate all finance queries after a mutation ─────────────
 // Replaces the old triggerRefresh() + fetchCategories() + fetchSources() pattern.
 // Invalidation causes TanStack Query to refetch active queries in the background.
 // LOW-h: panggilan POST /api/finance/budgets/snapshot dihapus — endpoint itu
 // tidak pernah ada (405 via fallback [id] route) sehingga snapshot auto-
 // rebuild adalah janji kosong. Snapshot (bila diperlukan) dibangun lewat
 // endpoint resmi saat fitur itu benar-benar ada.
 const invalidateFinance = useCallback(() => {
   queryClient.invalidateQueries({ queryKey: ['finance'] });
   // Also notify other components (e.g. dashboard) that data changed
   triggerRefresh();
 }, [queryClient, triggerRefresh]);

 // ── Transaction CRUD ──────────────────────────────────────────────────────

 const openNewTx = useCallback((type: 'income' | 'expense') => {
   setEditingTx(null);
   // BUGHUNT-47 (47-b #2): reset penanda sesi aturan — auto-kategorisasi
   // hanya berlaku sekali per dialog (lihat efek aturan di bawah).
   ruleAppliedRef.current = false;
   // Audit fix: use Jakarta timezone for date + time prefill (was using
   // date-fns `format(now, ...)` which uses the BROWSER's local TZ).
   // On Vercel (UTC server) or for a traveler in Tokyo (UTC+9), the
   // prefilled date/time would be wrong — e.g., a user in Tokyo opening
   // the dialog at 14:30 local sees "14:30" prefilled, but the app is
   // Jakarta-based so the transaction should be logged as 12:30 Jakarta.
   // Now consistent with openEditTx() which already uses Jakarta TZ.
   const p = jakartaNowParts();
   const time = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
   // H1: prefill sumber dari sumber dana AKTIF pertama (nama). Sebelumnya
   // hardcoded 'Kas' — dengan resolve by-name di API, nama yang tidak ada
   // membuat POST 400. Sumber fallback (tanpa id) tidak dipakai prefill.
   const defaultSource = getActiveSources().find((s) => !!s.id)?.name ?? '';
   setTxForm({ type, amount: '', category: '', description: '', date: jakartaDateString(), time, notes: '', source: defaultSource, tags: [] });
   // Reset split state every time the dialog opens fresh.
   setSplitMode(false);
   setSplitRows([
     { category: '', amount: '' },
     { category: '', amount: '' },
   ]);
   setTxDialogOpen(true);
 }, [getActiveSources]);

 // ── BUGHUNT-47 (47-b #2): mesin ATURAN (auto-kategorisasi) ────────────
 // Sub-tab "Aturan" menjanjikan "transaksi baru yang deskripsinya memuat
 // kata kunci otomatis dikategorikan" — tetapi tidak ada satu pun kode
 // yang membaca TransactionRule saat membuat transaksi (fitur no-op).
 // Kini: saat user mengetik deskripsi di dialog BARU dan belum memilih
 // kategori, aturan aktif (priority tertinggi yang cocok) mengisi kategori
 // + sumber otomatis. SEKALI per sesi dialog; pilihan eksplisit user tidak
 // pernah ditimpa (begitu kategori terisi — manual maupun aturan — efek
 // berhenti). Murni client-side: kontrak API tidak berubah.
 const ruleAppliedRef = useRef(false);
 const { data: txRules = [] } = useQuery<TransactionRule[]>({
   queryKey: ['finance', 'rules'],
   queryFn: async () => {
     const res = await fetch('/api/finance/rules');
     if (!res.ok) return [];
     return (await res.json()).rules ?? [];
   },
   staleTime: 60_000,
 });
 const txRulesRef = useRef(txRules);
   useEffect(() => { txRulesRef.current = txRules; }, [txRules]);
   const sourcesForRulesRef = useRef(getActiveSources);
   useEffect(() => { sourcesForRulesRef.current = getActiveSources; }, [getActiveSources]);
   useEffect(() => {
     if (editingTx) return;
     if (ruleAppliedRef.current) return;
     if (txForm.category) {
       // user sudah memilih kategori sendiri → matikan auto untuk sesi ini
       ruleAppliedRef.current = true;
       return;
     }
     const desc = txForm.description.trim().toLowerCase();
     if (!desc) return;
     const rules = [...txRulesRef.current].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
     const hit = rules.find(
       (r) => r.keyword && r.keyword.trim() && desc.includes(r.keyword.trim().toLowerCase()),
     );
     if (!hit) return;
     ruleAppliedRef.current = true;
     const sourceName = hit.sourceId
       ? sourcesForRulesRef.current().find((s) => s.id === hit.sourceId)?.name ?? null
       : null;
     setTxForm((p) => ({
       ...p,
       category: hit.category,
       ...(sourceName && !p.source ? { source: sourceName } : {}),
     }));
     toast.info(`Kategori terisi otomatis dari aturan "${hit.keyword}"`);
   }, [editingTx, txForm.category, txForm.description]);

 // BUGHUNT-ROUND2 FAB-1: consume the FAB quick-add action. Runs whenever
 // the Finance tab is live (this hook is only used by the Finance page)
 // and the store holds an expense/income action — opens the pre-filled
 // transaction dialog, then clears the action. Uses functional deps so
 // eslint is satisfied and the latest openNewTx identity is used.
 const openNewTxRef = useRef(openNewTx);
 openNewTxRef.current = openNewTx;
 useEffect(() => {
   if (quickAddAction === 'expense' || quickAddAction === 'income') {
     openNewTxRef.current(quickAddAction);
     clearQuickAdd();
   }
 }, [quickAddAction, clearQuickAdd]);

 const openEditTx = useCallback((tx: Transaction) => {
   setEditingTx(tx);
   // BUGHUNT-47 (47-b #2): edit tidak pernah auto-kategorisasi.
   ruleAppliedRef.current = true;
   // H3: Transaction.date menyimpan KOMPONEN UTC = jam dinding Jakarta
   // (jam disimpan sebagai jam UTC). Prefill date+time dibaca LANGSUNG dari
   // komponen ISO (slice), bukan dikonversi +7 — konversi Intl 'Asia/Jakarta'
   // lama menggeser 7 jam (19:58 → 02:58) dan bisa pindah hari.
   const iso = String(tx.date);
   const txDate = iso.slice(0, 10);
   const txTime = /^\d{2}:\d{2}$/.test(iso.slice(11, 16)) ? iso.slice(11, 16) : '';
   // M2: prefill sumber berdasarkan sourceId → nama TERKINI (tahan rename),
   // fallback sourceName/source. tx.source selalu undefined di data API
   // (serializeTransaction hanya mengirim sourceName).
   const sourceName =
     getActiveSources().find((s) => s.id === tx.sourceId)?.name ??
     tx.sourceName ??
     tx.source ??
     '';
   setTxForm({
     // BUGHUNT-47 (47-b #7): nominal desimal (mis. Rp9,99 dari import/fee)
     // dulu ter-format "9,99" → koma desimal dibuang parser → tersimpan 999
     // (nominal berubah diam-diam saat edit). Prefill dibulatkan ke rupiah.
     type: tx.type, amount: formatNominalInput(String(Math.round(tx.amount))), category: tx.category,
     description: tx.description || '', date: txDate, time: txTime,
     notes: tx.notes || '', source: sourceName,
     // PHASE4-POLISH: parse the stored JSON array string into a string[].
     // parseTags is null-safe and returns [] for missing/invalid input.
     tags: parseTags(tx.tags),
   });
   // Edit always uses single-category mode — split children are
   // standalone transactions and are edited one at a time.
   setSplitMode(false);
   setTxDialogOpen(true);
 }, [getActiveSources]);

 // ── Split helpers ────────────────────────────────────────────────────────

 const addSplitRow = useCallback(() => {
   // Cap at 10 rows — matches the API-side zod .max(10) constraint.
   setSplitRows(prev => prev.length >= 10 ? prev : [...prev, { category: '', amount: '' }]);
 }, []);

 const updateSplitRow = useCallback((idx: number, field: 'category' | 'amount', value: string) => {
   setSplitRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: field === 'amount' ? formatNominalInput(value) : value } : row));
 }, []);

 const removeSplitRow = useCallback((idx: number) => {
   setSplitRows(prev => {
     // Don't allow fewer than 2 rows — that's the split minimum.
     if (prev.length <= 2) return prev;
     return prev.filter((_, i) => i !== idx);
   });
 }, []);

 // Sum of all split row amounts (whole rupiah). Used for the real-time
 // total indicator + final payload.
 const splitTotal = useMemo(() => {
   return splitRows.reduce((sum, r) => sum + (parseInt(parseNominalInput(r.amount) || '0', 10) || 0), 0);
 }, [splitRows]);

 const handleSubmitTx = useCallback(async (event?: React.MouseEvent<HTMLButtonElement>) => {
   // BUG-5 fix: double-submit guard. If a submission is already in flight
   // (e.g. the user double-clicked Simpan), bail out immediately. The guard
   // is set right before the async fetch and reset in each finally block, so
   // validation-failure early returns below don't leave it stuck as true.
   if (submitGuard.current) return;
   // ── Split mode branch ──
   // Split is only valid for CREATE (not editing — each split child is
   // edited individually via the regular single-category form).
   if (splitMode && !editingTx) {
     // Validate: at least 2 rows with category + amount > 0
     const validRows = splitRows.filter(r => r.category && parseNominalInput(r.amount) && parseInt(parseNominalInput(r.amount), 10) > 0);
     if (validRows.length < 2) { toast.error('Minimal 2 kategori dengan jumlah valid untuk split'); return; }
     if (!txForm.date) { toast.error('Pilih tanggal'); return; }
     if (splitTotal <= 0) { toast.error('Total split harus lebih dari 0'); return; }
     // Parse date+time with explicit Jakarta offset (+07:00) — same
     // pattern as the non-split path below.
     const fullDate = txForm.time
       ? new Date(`${txForm.date}T${txForm.time}:00+07:00`)
       : new Date(`${txForm.date}T00:00:00+07:00`);
     const payload = {
       date: fullDate.toISOString(),
       source: txForm.source,
       description: txForm.description || null,
       splits: validRows.map(r => ({
         category: r.category,
         amount: parseInt(parseNominalInput(r.amount), 10),
       })),
     };
     submitGuard.current = true;
     setSubmitting(true);
     try {
       const res = await fetch('/api/finance/transactions/split', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });
       if (res.ok) {
         toast.success(`Split transaction berhasil (${validRows.length} kategori)`);
         setTxDialogOpen(false);
         invalidateFinance();
       } else {
         const err = await res.json().catch(() => null);
         toast.error(err?.error || 'Gagal membuat split transaction');
         return;
       }
     } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); submitGuard.current = false; }
     return;
   }

   // ── Regular (non-split) branch ──
   const rawAmount = parseNominalInput(txForm.amount);
   if (!rawAmount || parseFloat(rawAmount) <= 0) { toast.error('Masukkan jumlah yang valid'); return; }
   // H1 (lanjutan): API memvalidasi amount sebagai NUMBER (asNumber) —
   // kirim angka, bukan string digit. Payload lama mengirim '15000'
   // (string) → selalu 400 "Jumlah transaksi tidak valid".
   const amountNum = parseFloat(rawAmount);
   if (!txForm.category) { toast.error('Pilih kategori'); return; }
   if (!txForm.date) { toast.error('Pilih tanggal'); return; }
   // Audit fix: parse date+time with explicit Jakarta offset (+07:00).
   // Previously `new Date('2025-01-15T14:30:00')` (no offset) parsed as
   // the BROWSER's local TZ — so a user in Tokyo (UTC+9) submitting "14:30"
   // would store an epoch that corresponds to 12:30 Jakarta. Now the
   // epoch always corresponds to the Jakarta wall-clock the user typed,
   // regardless of their device timezone. Consistent with openNewTx/openEditTx
   // which both prefill using Jakarta TZ.
   const fullDate = txForm.time
     ? new Date(`${txForm.date}T${txForm.time}:00+07:00`)
     : new Date(`${txForm.date}T00:00:00+07:00`);
   const payload = { ...txForm, amount: amountNum, date: fullDate.toISOString() };
   submitGuard.current = true;
   setSubmitting(true);
   try {
     if (editingTx) {
       const res = await fetch(`/api/finance/transactions/${editingTx.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       // BUGHUNT-ROUND2 TOAST-ERR: surface the API's specific error message
       // (e.g. "Saldo sumber dana tidak mencukupi...") instead of a generic
       // one — matches the delete handler's behavior.
       if (res.ok) toast.success('Transaksi berhasil diupdate');
       else {
         const err = await res.json().catch(() => null);
         toast.error(err?.error || 'Gagal mengupdate transaksi');
         return;
       }
     } else {
       const res = await fetch('/api/finance/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       if (res.ok) { toast.success('Transaksi berhasil ditambahkan'); smallPop((event?.currentTarget as HTMLElement | undefined) ?? null); } else {
         // LOW-e: tampilkan pesan error SPESIFIK dari API (bukan generik) —
         // selaras handler PUT di atas.
         const err = await res.json().catch(() => null);
         toast.error(err?.error || 'Gagal menambahkan transaksi');
         return;
       }
       // ANIM-2 / Feature 3: fire money particles when an income transaction
       // is added. Split mode is expense-only, so this only applies to the
       // regular single-transaction branch (txForm.type === 'income').
       if (txForm.type === 'income') {
         setMoneyParticlesKey(k => k + 1);
       }
     }
     setTxDialogOpen(false);
     invalidateFinance();
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); submitGuard.current = false; }
 }, [splitMode, editingTx, splitRows, txForm, splitTotal, invalidateFinance]);

 const handleDeleteTx = useCallback(async () => {
   if (!deletingId) return;
   // LOW-g: guard double-submit — klik ganda di dialog konfirmasi tidak
   // memicu DELETE kedua (submitGuard ref, reset di finally).
   if (submitGuard.current) return;
   submitGuard.current = true;
   setSubmitting(true);
   try {
     const res = await fetch(`/api/finance/transactions/${deletingId}`, { method: 'DELETE' });
     if (res.ok) {
       toast.success('Transaksi berhasil dihapus');
       setDeleteDialogOpen(false);
       setDeletingId(null);
       invalidateFinance();
     } else {
       // Show the API's error message (e.g. transfer transactions can't be deleted)
       const err = await res.json().catch(() => null);
       toast.error(err?.error || 'Gagal menghapus transaksi');
     }
   } catch { toast.error('Terjadi kesalahan'); } finally { submitGuard.current = false; setSubmitting(false); }
 }, [deletingId, invalidateFinance]);

 // ── Budget CRUD ───────────────────────────────────────────────────────────

 const handleSubmitBudget = useCallback(async () => {
   if (!budgetForm.category) { toast.error('Pilih kategori'); return; }
   const rawBudgetAmount = parseNominalInput(budgetForm.amount);
   if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) { toast.error('Masukkan jumlah budget yang valid'); return; }
   // H1 (lanjutan): API memvalidasi amount sebagai NUMBER — kirim angka.
   const budgetAmountNum = parseFloat(rawBudgetAmount);
   // M5: kirim month eksplisit (selectedMonth) — tanpa ini API selalu memakai
   // bulan berjalan sehingga budget yang dibuat saat melihat bulan lain
   // tersimpan di bulan yang salah.
   const budgetPayload = { ...budgetForm, amount: budgetAmountNum, month: selectedMonth };
   setSubmitting(true);
   try {
     const res = await fetch('/api/finance/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budgetPayload) });
     if (res.ok) { toast.success('Budget berhasil disimpan'); setBudgetDialogOpen(false); invalidateFinance(); }
     else { const err = await res.json().catch(() => null); toast.error(err?.error || 'Gagal menyimpan budget'); }
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
 }, [budgetForm, selectedMonth, invalidateFinance]);

 const handleDeleteBudget = useCallback(async (id: string) => {
   try {
     const res = await fetch(`/api/finance/budgets/${id}`, { method: 'DELETE' });
     // LOW-f: kegagalan hapus tidak lagi diam — pesan API (mis. 404) tampil
     // sebagai toast error.
     if (res.ok) { toast.success('Budget berhasil dihapus'); invalidateFinance(); }
     else { const err = await res.json().catch(() => null); toast.error(err?.error || 'Gagal menghapus budget'); }
   } catch { toast.error('Gagal menghapus budget'); }
 }, [invalidateFinance]);

 const openEditBudget = useCallback((b: BudgetItem) => {
   setEditingBudget(b);
   setBudgetForm({ category: b.category, amount: formatNominalInput(String(b.amount)), period: b.period || 'monthly' });
   setBudgetEditOpen(true);
 }, []);

 const handleSubmitEditBudget = useCallback(async () => {
   if (!editingBudget) return;
   if (!budgetForm.category) { toast.error('Pilih kategori'); return; }
   const rawBudgetAmount = parseNominalInput(budgetForm.amount);
   if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) { toast.error('Masukkan jumlah budget yang valid'); return; }
   // H1 (lanjutan): API memvalidasi amount sebagai NUMBER — kirim angka.
   const budgetAmountNum = parseFloat(rawBudgetAmount);
   // M5: ikutkan month (dari item yang diedit, fallback selectedMonth) supaya
   // edit budget bulan lain tidak diam-diam memindahkan/diabaikan bulannya.
   const budgetPayload = { category: budgetForm.category, amount: budgetAmountNum, period: budgetForm.period, month: editingBudget.month || selectedMonth };
   setSubmitting(true);
   try {
     const res = await fetch(`/api/finance/budgets/${editingBudget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budgetPayload) });
     if (res.ok) { toast.success('Budget berhasil diupdate'); setBudgetEditOpen(false); setEditingBudget(null); invalidateFinance(); }
     else { const err = await res.json().catch(() => null); toast.error(err?.error || 'Gagal mengupdate budget'); }
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
 }, [editingBudget, budgetForm, selectedMonth, invalidateFinance]);

 // ── Category CRUD ─────────────────────────────────────────────────────────

 const openNewCat = useCallback((type: 'income' | 'expense') => {
   setEditingCat(null);
   setCatForm({ type, name: '', emoji: '📦', color: '#78716c', trackLastDone: false });
   setCatFormOpen(true);
 }, []);

 const openEditCat = useCallback((cat: FinanceCategory) => {
   setEditingCat(cat);
   setCatForm({ type: cat.type, name: cat.name, emoji: cat.emoji, color: cat.color, trackLastDone: cat.trackLastDone });
   setCatFormOpen(true);
 }, []);

 const handleSubmitCat = useCallback(async () => {
   if (!catForm.name.trim()) { toast.error('Masukkan nama kategori'); return; }
   setSubmitting(true);
   try {
     if (editingCat) {
       const res = await fetch(`/api/finance/categories/${editingCat.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
       if (res.ok) toast.success('Kategori berhasil diupdate'); else { const err = await res.json(); toast.error(err.error || 'Gagal mengupdate kategori'); return; }
     } else {
       const res = await fetch('/api/finance/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
       if (res.ok) toast.success('Kategori berhasil ditambahkan'); else { toast.error('Gagal menambahkan kategori'); return; }
     }
     setCatFormOpen(false);
     invalidateFinance();
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
 }, [catForm, editingCat, invalidateFinance]);

 const handleDeleteCat = useCallback(async (cat: FinanceCategory) => {
   try {
     const res = await fetch(`/api/finance/categories/${cat.id}`, { method: 'DELETE' });
     if (res.ok) { toast.success('Kategori berhasil dihapus'); invalidateFinance(); }
     else { const err = await res.json(); toast.error(err.error || 'Gagal menghapus kategori'); }
   } catch { toast.error('Terjadi kesalahan'); }
 }, [invalidateFinance]);

 // ── Source CRUD ─────────────────────────────────────────────────────────

 const openNewSource = useCallback(() => { setEditingSource(null); setSourceForm({ name: '', emoji: '💵', balance: 0 }); setSourceFormOpen(true); }, []);
 // H2: prefill SALDO AWAL asli (initialBalance) — bukan saldo terhitung
 // (balance). PUT menulis initialBalance; memakai saldo terhitung membuat
 // saldo bergeser setiap kali user hanya mengganti nama/emoji. Perubahan
 // saldo aktual tetap lewat PATCH inline-edit di daftar sumber.
 const openEditSource = useCallback((src: FundSource) => { setEditingSource(src); setSourceForm({ name: src.name, emoji: src.emoji, balance: src.initialBalance ?? 0 }); setSourceFormOpen(true); }, []);

 const handleSubmitSource = useCallback(async () => {
   if (!sourceForm.name.trim()) { toast.error('Masukkan nama sumber dana'); return; }
   setSubmitting(true);
   // API membaca field `initialBalance` (schema Prisma) — form memakai
   // `balance`, jadi dipetakan di sini supaya POST/PUT tidak menyimpan 0.
   const payload = {
     name: sourceForm.name.trim(),
     emoji: sourceForm.emoji,
     initialBalance: sourceForm.balance,
   };
   try {
     if (editingSource) {
       const res = await fetch(`/api/finance/sources/${editingSource.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       if (res.ok) toast.success('Sumber dana berhasil diupdate'); else { const err = await res.json(); toast.error(err.error || 'Gagal mengupdate'); return; }
     } else {
       const res = await fetch('/api/finance/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       if (res.ok) toast.success('Sumber dana berhasil ditambahkan'); else { const err = await res.json(); toast.error(err.error || 'Gagal menambahkan'); return; }
     }
     setSourceFormOpen(false); invalidateFinance();
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
 }, [sourceForm, editingSource, invalidateFinance]);

 const handleDeleteSource = useCallback(async (src: FundSource) => {
   try {
     const res = await fetch(`/api/finance/sources/${src.id}`, { method: 'DELETE' });
     if (res.ok) { toast.success('Sumber dana berhasil dihapus'); invalidateFinance(); }
     else { const err = await res.json(); toast.error(err.error || 'Gagal menghapus'); }
   } catch { toast.error('Terjadi kesalahan'); }
 }, [invalidateFinance]);

 const handleSaveBalance = useCallback(async (sourceId: string) => {
   // LOW-k: nilai negatif ditampilkan apa adanya di input inline — pertahan-
   // kan tanda minus saat parse (parseNominalInput melepas tanda). Input
   // sendiri hanya menerima digit; minus hanya bertahan pada prefill yang
   // tidak disentuh (kasus no-op di bawah mem-bypass PATCH).
   const rawTrim = balanceEditValue.trim();
   const digits = parseNominalInput(rawTrim);
   if (!digits) { setBalanceEditId(null); setBalanceEditValue(''); return; }
   const magnitude = Number(digits) || 0;
   // BUGHUNT-54 (3-a #4): prefill diformat "Rp -50.000" — startsWith('-')
   // TIDAK pernah match karena string diawali awalan "Rp ", sehingga saldo
   // negatif terbalik jadi positif saat disimpan. Deteksi tanda minus ('-'
   // atau '−') di posisi mana pun (hanya prefill yang memuatnya; ketikan
   // user dibersihkan dari minus oleh onChange) dan pertahankan tanda —
   // guard no-op di bawah kini membandingkan nilai bertanda dengan benar.
   const val = /[-−]/.test(rawTrim) ? -magnitude : magnitude;

   // Bug fix: skip PATCH if value unchanged (user clicked then blurred
   // without editing). Avoids unnecessary network call + toast spam.
   const source = getActiveSources().find((s) => s.id === sourceId);
   const currentBalance = source?.balance ?? 0;
   if (val === currentBalance) {
     setBalanceEditId(null);
     setBalanceEditValue('');
     return;
   }

   try {
     // PATCH saldo ada di /api/finance/sources/[id] (body { balance }) —
     // bukan /balance (sub-route itu tidak ada → 404 diam-diam).
     const res = await fetch(`/api/finance/sources/${sourceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: val }) });
     if (res.ok) {
       const data = await res.json();
       // CONNECTED-APP: edit saldo mengubah KPI Keuangan (total saldo,
       // runway, budget) + kartu keuangan tab Progres — invalidasi penuh
       // ['finance'] + triggerRefresh (dulu hanya 3 key sempit → KPI stale).
       invalidateFinance();
       // Show informative toast based on whether an adjustment was made
       if (data?.adjustment) {
         const adj = data.adjustment;
         const sign = adj.type === 'income' ? '+' : '−';
         toast.success(`Saldo diupdate — transaksi "${sign}${formatRupiah(adj.amount)}" dibuat`);
       } else {
         toast.success('Saldo diupdate');
       }
     } else {
       const err = await res.json().catch(() => null);
       toast.error(err?.error || 'Gagal update saldo');
     }
   } catch { toast.error('Gagal update saldo'); }
   setBalanceEditId(null); setBalanceEditValue('');
 }, [balanceEditValue, getActiveSources, queryClient]);

 // ── Bulk Delete ─────────────────────────────────────────────────────────

 const toggleSelectTx = useCallback((id: string) => {
   setSelectedTxIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
 }, []);

 // toggleSelectAll depends on the currently filtered transactions list —
 // injected via parameter so the hook stays decoupled from filtering logic.
 const toggleSelectAll = useCallback((filteredTxIds: string[]) => {
   setSelectedTxIds(prev => {
     if (prev.size === filteredTxIds.length && filteredTxIds.every(id => prev.has(id))) return new Set();
     return new Set(filteredTxIds);
   });
 }, []);

 const handleBulkDelete = useCallback(async () => {
   if (selectedTxIds.size === 0) return;
   setSubmitting(true);
   try {
     const res = await fetch('/api/finance/transactions/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedTxIds) }) });
     if (res.ok) { const data = await res.json(); toast.success(`${data.deleted} transaksi berhasil dihapus`); setSelectedTxIds(new Set()); setBulkDeleteOpen(false); invalidateFinance(); }
     else toast.error('Gagal menghapus transaksi');
   } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
 }, [selectedTxIds, invalidateFinance]);

 return {
   // ── Dialog open states + setters ──
   txDialogOpen, setTxDialogOpen,
   budgetDialogOpen, setBudgetDialogOpen,
   budgetEditOpen, setBudgetEditOpen,
   deleteDialogOpen, setDeleteDialogOpen,
   catDialogOpen, setCatDialogOpen,
   catFormOpen, setCatFormOpen,
   sourceDialogOpen, setSourceDialogOpen,
   sourceFormOpen, setSourceFormOpen,
   bulkDeleteOpen, setBulkDeleteOpen,
   // ── Editing targets ──
   editingTx, setEditingTx,
   editingCat, setEditingCat,
   editingBudget, setEditingBudget,
   editingSource, setEditingSource,
   deletingId, setDeletingId,
   deletingSource, setDeletingSource,
   // ── Form state ──
   txForm, setTxForm,
   splitMode, setSplitMode,
   splitRows, setSplitRows,
   splitTotal,
   addSplitRow, updateSplitRow, removeSplitRow,
   calcOpen, setCalcOpen,
   budgetForm, setBudgetForm,
   catForm, setCatForm,
   sourceForm, setSourceForm,
   balanceEditId, setBalanceEditId,
   balanceEditValue, setBalanceEditValue,
   // ── Selection state ──
   selectedTxIds, setSelectedTxIds,
   // ── Submitting flag + money particles ──
   submitting,
   moneyParticlesKey, setMoneyParticlesKey,
   // ── Handlers: Transaction ──
   openNewTx, openEditTx,
   handleSubmitTx, handleDeleteTx,
   // ── Handlers: Budget ──
   handleSubmitBudget, handleDeleteBudget,
   openEditBudget, handleSubmitEditBudget,
   // ── Handlers: Category ──
   openNewCat, openEditCat,
   handleSubmitCat, handleDeleteCat,
   // ── Handlers: Source ──
   openNewSource, openEditSource,
   handleSubmitSource, handleDeleteSource,
   handleSaveBalance,
   // ── Handlers: Bulk ──
   toggleSelectTx, toggleSelectAll,
   handleBulkDelete,
   // ── Misc ──
   invalidateFinance,
 };
}

