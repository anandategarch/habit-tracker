'use client';

// components/habit-tracker/use-habit-master-form.ts — sesi dialog create/edit
// habit (hasil pemecahan habit-master.tsx, Task 71-b): state dialog + form,
// alur quick-add FAB (store), validasi form, dan pemulangan returnTab.
// Mutasi server ada di use-habit-master-data (submitHabit).

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  type Habit,
  type HabitFormData,
  emptyForm,
  habitToForm,
} from './habit-master-types';

/** Sesi dialog yang dipakai HabitFormDialog + komposisi root (openAdd untuk
 *  CTA empty-state, openEdit untuk tabel/kartu, formEmojiPicker untuk efek
 *  tutup-klik-luar popover bersama quick-add bar). */
export interface HabitFormSession {
  dialogOpen: boolean;
  editingId: string | null;
  form: HabitFormData;
  submitting: boolean;
  formEmojiPicker: boolean;
  setFormEmojiPicker: (v: boolean) => void;
  openAdd: () => void;
  openEdit: (h: Habit) => void;
  handleDialogOpenChange: (open: boolean) => void;
  updateForm: <K extends keyof HabitFormData>(key: K, value: HabitFormData[K]) => void;
  toggleScheduleDay: (d: number) => void;
  toggleScheduleDate: (n: number) => void;
  submit: () => Promise<void>;
}

export function useHabitMasterForm(
  /** Mutasi simpan (use-habitMasterData.submitHabit) — true = sukses. */
  onSubmit: (form: HabitFormData, editingId: string | null) => Promise<boolean>,
): HabitFormSession {
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HabitFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formEmojiPicker, setFormEmojiPicker] = useState(false);

  // BUGHUNT-ROUND2 FAB-1: FAB quick-add consumer. The mobile FAB "Habit
  // Baru" button navigates to the Settings tab; settings.tsx switches to
  // the 'habits' section (mounting this component), then this effect opens
  // the add-habit dialog and clears the store action. If the user is
  // already on this section, it fires directly. (openAdd kini useCallback
  // stabil — dipanggil langsung, tanpa render-phase ref assignment.)
  const quickAddAction = useAppStore(s => s.quickAddAction);
  const clearQuickAdd = useAppStore(s => s.clearQuickAdd);
  // CONNECTED-APP: tab asal quick-add habit — setelah habit baru tersimpan,
  // user kembali ke konteks asal (Beranda/Tracker), bukan terdampar di
  // Pengaturan → Habit Master.
  const quickAddReturnTab = useAppStore(s => s.quickAddReturnTab);
  const clearQuickAddReturn = useAppStore(s => s.clearQuickAddReturn);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  // BUGHUNT-47 (47-d #4): flag sesi — hanya sesi dialog yang DIBUKA quick-add
  // yang boleh memulangkan user ke returnTab.
  const openedViaQuickAddRef = useRef(false);

  const openAdd = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm());
    // BUGHUNT-47 (47-d #4): pembukaan NORMAL (tombol "Habit Baru") bukan
    // sesi quick-add — flag lokal dipakai saat create supaya returnTab basi
    // (quick-add yang dibatalkan) tidak "menelportkan" user ke tab lama.
    openedViaQuickAddRef.current = false;
    setDialogOpen(true);
  }, []);

  function openEdit(h: Habit) {
    setEditingId(h.id);
    setForm(habitToForm(h));
    // BUGHUNT-47 (47-d #4): sesi edit juga bukan quick-add.
    openedViaQuickAddRef.current = false;
    setDialogOpen(true);
  }

  // BUGHUNT-47 (47-d #4): dialog ditutup tanpa create sukses (Batal/Escape/
  // overlay) → returnTab quick-add tidak boleh tersimpan basi di store.
  // Task 61-f (audit 61-b P2): dialog yang DIBUKA via quick-add lalu DIBATALKAN
  // (Batal/X/Escape/overlay) kini memulangkan user ke tab asal — dulu hanya
  // jalur SIMPAN yang memulangkan (handleSubmit), sehingga batal meninggalkan
  // user terdampar di tab Pengaturan. Jalur simpan tidak dobel-restore:
  // submit memanggil setDialogOpen(false) LANGSUNG (bukan lewat handler
  // ini) dan sudah clearQuickAddReturn() lebih dulu.
  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      if (openedViaQuickAddRef.current && quickAddReturnTab) {
        setActiveTab(quickAddReturnTab);
      }
      openedViaQuickAddRef.current = false;
      clearQuickAddReturn();
      // Task 61-f (audit 61-a P3): popover emoji ikut ditutup — dulu bisa
      // tersisa terbuka saat dialog ditutup via Escape (tanpa pointer).
      setFormEmojiPicker(false);
    }
    setDialogOpen(open);
  }

  useEffect(() => {
    if (quickAddAction === 'habit') {
      // BUGHUNT-54 (3-d #1): openAdd() me-reset openedViaQuickAddRef ke
      // false (kontrak 47-d #4 untuk pembukaan NORMAL). Dulu flag diset
      // DULU lalu openAdd() menimpanya → sesi quick-add kehilangan status
      // → setelah simpan habit user terdampar di Pengaturan. Urutan yang
      // benar: buka dialog dulu, baru tandai sesi ini sebagai quick-add.
      openAdd();
      openedViaQuickAddRef.current = true;
      clearQuickAdd();
    }
  }, [quickAddAction, clearQuickAdd, openAdd]);

  // ── Form field updater ─────────────────────────────────────────────────

  function updateForm<K extends keyof HabitFormData>(key: K, value: HabitFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Task 37 — toggle hari/tanggal jadwal (chip multi-pilih di form).
  function toggleScheduleDay(d: number) {
    setForm((prev) => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(d)
        ? prev.scheduleDays.filter((x) => x !== d)
        : [...prev.scheduleDays, d],
    }));
  }
  function toggleScheduleDate(n: number) {
    setForm((prev) => ({
      ...prev,
      scheduleDates: prev.scheduleDates.includes(n)
        ? prev.scheduleDates.filter((x) => x !== n)
        : [...prev.scheduleDates, n],
    }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  // Validasi SEBELUM setSubmitting (persis handleSubmit lama: input tidak
  // valid tidak pernah menyalakan state "Menyimpan..."). Mutasi + toast
  // server ada di onSubmit (use-habit-master-data.submitHabit).

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Nama habit wajib diisi');
      return;
    }
    // Task 37 — validasi jadwal: pilih minimal satu hari/tanggal.
    if (form.scheduleKind === 'weekly' && form.scheduleDays.length === 0) {
      toast.error('Pilih minimal satu hari untuk jadwal mingguan');
      return;
    }
    if (form.scheduleKind === 'monthly' && form.scheduleDates.length === 0) {
      toast.error('Pilih minimal satu tanggal untuk jadwal bulanan');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSubmit(form, editingId);
      if (ok) {
        // CONNECTED-APP (jalur create): pulangkan user ke konteks asal
        // quick-add (Hari Ini / Tracker) — dulu setelah "Tambah Rutinitas
        // Pertama" user terdampar di Pengaturan dan harus navigasi manual
        // kembali.
        // BUGHUNT-47 (47-d #4): hanya untuk sesi yang DIBUKA via quick-add —
        // returnTab basi (quick-add dibatalkan lalu user membuat habit biasa)
        // tidak lagi men-teleport user.
        if (!editingId) {
          if (quickAddReturnTab && openedViaQuickAddRef.current) {
            setActiveTab(quickAddReturnTab);
          }
          clearQuickAddReturn();
        }
        setDialogOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
    dialogOpen,
    editingId,
    form,
    submitting,
    formEmojiPicker,
    setFormEmojiPicker,
    openAdd,
    openEdit,
    handleDialogOpenChange,
    updateForm,
    toggleScheduleDay,
    toggleScheduleDate,
    submit,
  };
}
