// ---------------------------------------------------------------------------
// src/components/work/work-notes-autosave.ts — mesin status dialog catatan
// (pecahan Task 71-e dari work-notes.tsx): draft + autosave saat jeda mengetik,
// mode BACA/UBAH, konfirmasi hapus dua langkah, dan centang interaktif.
// Mutasi tetap memakai hook use-work-api (query key & payload tak berubah).
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useRef, useState } from 'react';
import { useDeleteNote, useSaveNote, useToggleNoteCheck } from './use-work-api';
import { NOTE_CONTENT_MAX, type WorkNoteItem, type WorkPayload } from './work-types';
import { toggleNoteCheck } from './note-markdown';

// ── Dialog catatan: mode BACA + UBAH ───────────────────────────────────────

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface NoteDraft {
  id: string | null;
  content: string;
  tag: string;
}

export function useNoteDialog(date: string, data: WorkPayload | undefined) {
  // Dialog catatan.
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const draftRef = useRef<NoteDraft | null>(null);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Konfirmasi hapus dua langkah: klik 1 = senjatakan, klik 2 = hapus.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedFlash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saveNote = useSaveNote(date);
  const deleteNote = useDeleteNote(date);
  const noteCheck = useToggleNoteCheck(date);

  // Bersihkan semua timer saat komponen dilepas.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(savedFlash.current);
      clearTimeout(confirmTimer.current);
    },
    []
  );

  // ── Dialog: simpan otomatis (autosave saat jeda mengetik) ───────────────

  const updateDraft = (next: NoteDraft) => {
    draftRef.current = next;
    setDraft(next);
  };

  const doSave = () => {
    clearTimeout(saveTimer.current);
    const current = draftRef.current;
    if (!current) return;
    const content = current.content.trim();
    if (!content) {
      setSaveState('idle');
      return;
    }
    if (content.length > NOTE_CONTENT_MAX) {
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    saveNote.mutate(
      {
        id: current.id ?? undefined,
        content,
        tag: current.tag.trim() ? current.tag.trim().replace(/^#/, '') : '',
        quiet: true,
      },
      {
        onSuccess: (note) => {
          if (!current.id && note && typeof note === 'object' && 'id' in note) {
            const newId = String((note as { id: unknown }).id);
            // Task 30 (bug: catatan ganda saat edit): id catatan baru HARUS
            // disinkronkan ke STATE juga, bukan hanya draftRef. Tanpa ini,
            // ketukan berikutnya menyusun draft dari state yang masih id:null
            // → menimpa draftRef → autosave berikutnya POST lagi → muncul
            // catatan duplikat pada tiap jeda ketik ("edit malah tambah baru").
            if (draftRef.current) draftRef.current = { ...draftRef.current, id: newId };
            setDraft((prev) => (prev && !prev.id ? { ...prev, id: newId } : prev));
          }
          setSaveState('saved');
          clearTimeout(savedFlash.current);
          savedFlash.current = setTimeout(() => setSaveState('idle'), 1800);
        },
        onError: () => setSaveState('error'),
      }
    );
  };

  const scheduleSave = (delay = 900) => {
    clearTimeout(saveTimer.current);
    setSaveState('dirty');
    saveTimer.current = setTimeout(() => doSave(), delay);
  };

  const openNote = (note: WorkNoteItem) => {
    clearTimeout(saveTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('read');
    const next: NoteDraft = { id: note.id, content: note.content, tag: note.tag ?? '' };
    draftRef.current = next;
    setDraft(next);
  };

  const openNew = () => {
    clearTimeout(saveTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('edit');
    const next: NoteDraft = { id: null, content: '', tag: '' };
    draftRef.current = next;
    setDraft(next);
  };

  const closeDialog = () => {
    // Ada perubahan yang belum terkirim? Kirim dulu (fire-and-forget).
    if (saveState === 'dirty') doSave();
    clearTimeout(saveTimer.current);
    clearTimeout(confirmTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('read');
    draftRef.current = null;
    setDraft(null);
  };

  // Ubah → Baca ("Selesai"): simpan segera; catatan baru kosong = batal.
  const handleModeToRead = () => {
    const current = draftRef.current;
    if (!current) return;
    if (!current.content.trim()) {
      if (!current.id) {
        closeDialog();
        return;
      }
      const original = data?.notes.find((n) => n.id === current.id);
      updateDraft({ ...current, content: original?.content ?? current.content });
      setSaveState('idle');
      setMode('read');
      return;
    }
    doSave();
    setMode('read');
  };

  const handleModeChange = (next: 'read' | 'edit') => {
    if (next === 'read') handleModeToRead();
    else setMode('edit');
  };

  // Tombol hapus dua langkah: tekan pertama mengubah jadi "Yakin?", kedua
  // baru benar-benar menghapus; senjatakan ulang otomatis setelah 4 detik.
  const handleDeleteNote = () => {
    const current = draftRef.current;
    if (!current?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    clearTimeout(confirmTimer.current);
    clearTimeout(saveTimer.current);
    deleteNote.mutate(current.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        setSaveState('idle');
        setMode('read');
        draftRef.current = null;
        setDraft(null);
      },
    });
  };

  // Centang interaktif di mode BACA: update lokal + simpan senyap.
  const handleDialogToggleCheck = (lineIndex: number) => {
    const current = draftRef.current;
    if (!current) return;
    const next = toggleNoteCheck(current.content, lineIndex);
    updateDraft({ ...current, content: next });
    if (current.id) {
      noteCheck.mutate({ id: current.id, content: next });
    } else {
      scheduleSave(300);
    }
  };

  // Centang interaktif di kartu (optimistik via hook).
  const handleCardToggleCheck = (note: WorkNoteItem, lineIndex: number) => {
    noteCheck.mutate({ id: note.id, content: toggleNoteCheck(note.content, lineIndex) });
  };

  const onDraftChange = (next: NoteDraft) => {
    updateDraft(next);
    scheduleSave();
  };

  return {
    draft,
    mode,
    saveState,
    confirmDelete,
    deletePending: deleteNote.isPending,
    openNote,
    openNew,
    closeDialog,
    handleModeChange,
    handleDeleteNote,
    handleDialogToggleCheck,
    handleCardToggleCheck,
    onDraftChange,
    doSave,
  };
}
