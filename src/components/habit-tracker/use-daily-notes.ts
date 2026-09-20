'use client';

// components/habit-tracker/use-daily-notes.ts — catatan harian: state `notes`,
// debounce 600ms (M5 guard tanggal future), flush H2 (ganti tanggal &
// unmount keepalive), dan hint jumlah karakter.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// urutan efek (flush-on-date-change SEBELUM efek sinkron notes), guard
// saveTimerRef `=== timer` (H2-fix a), dan cache optimistik
// ['daily-logs', date] dipertahankan persis.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { saveDailyLog, htmlToPlainText } from './daily-tracker-helpers';
import type { DailyLogPayload } from './use-daily-log';

export interface DailyNotesApi {
  notes: string;
  handleNotesChange: (html: string) => void;
  /** PHASE4-POLISH: panjang teks terlihat untuk hint "X karakter". */
  notesCharCount: number;
}

export function useDailyNotes(opts: {
  selectedDate: string;
  todayStr: string;
  dailyLogData: DailyLogPayload | undefined;
  queryClient: QueryClient;
}): DailyNotesApi {
  const { selectedDate, todayStr, dailyLogData, queryClient } = opts;

  // ---- state ----
  const [notes, setNotes] = useState('');

  // ---- refs (notes autosave) ----
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG-19 fix: store the latest pending notes-save so we can fire-and-forget
  // it on unmount (using keepalive) instead of cancelling it. Previously the
  // debounced save was cancelled on unmount, so typing-then-navigating within
  // 600ms lost the user's notes silently.
  const pendingSaveRef = useRef<{ date: string; notes?: string } | null>(null);
  // M5: flag anti spam toast guard catatan tanggal future — toast standar
  // cukup sekali per kunjungan tanggal future (reset saat kembali ke tanggal
  // yang valid).
  const futureToastRef = useRef(false);

  // ── H2-fix (b): flush patch catatan tertunda ──────────────────────────
  // Saat selectedDate berubah, patch tertunda tanggal LAMA di-flush dulu
  // (fire-and-forget fetch keepalive) SEBELUM state debounce dibersihkan —
  // patch tanggal lama tidak hilang dan tidak menimpa catatan tanggal baru.
  // Tanpa ini ada race: timer lama masih aktif saat data tanggal baru tiba
  // (cache react-query bisa fresh) → guard "debounce aktif" di efek sinkron
  // notes melewatkan sinkronisasi → textarea kosong → 1 ketikan menimpa
  // catatan tersimpan (DATA-LOSS H2).
  // Cache ['daily-logs', tanggal lama] diperbarui optimistik supaya kembali
  // cepat ke tanggal itu (< staleTime 15s) tetap menampilkan draft.
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    queryClient.setQueryData<DailyLogPayload>(
      ['daily-logs', pending.date],
      (old) =>
        old
          ? { ...old, date: pending.date, notes: pending.notes ?? old.notes ?? null }
          : { date: pending.date, notes: pending.notes ?? null },
    );
    void saveDailyLog(pending, { keepalive: true })
      .then((res) => {
        // Konfirmasi server → tandai stale supaya observasi berikutnya
        // refetch (kebenaran akhir tetap di server).
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['daily-logs', pending.date] });
        }
      })
      .catch(() => {
        /* swallow — fire-and-forget, kegagalan akan terlihat saat refetch */
      });
  }, [queryClient]);

  // Dideklarasikan SEBELUM efek sinkron notes agar pada commit ganti tanggal
  // timer lama sudah bersih ketika guard sinkron membaca saveTimerRef.
  useEffect(() => {
    flushPendingSave();
  }, [selectedDate, flushPendingSave]);

  // keepPreviousData (global QueryClient default) means that right after a
  // date switch `dailyLogData` still holds the PREVIOUS date's log until the
  // new one arrives. Applying it unconditionally showed (and let the user
  // edit + auto-save) day A's notes under day B's header. Gate on the
  // response's own date and clear while the correct day is still loading.
  // GELOMBANG 1: refetch tanggal yang sama dipicu simpanan check-in/notes
  // (invalidate ['daily-logs', date]) — jangan menimpa draft yang sedang
  // diketik (debounce aktif) dengan nilai server yang lebih lama; draft
  // tersimpan oleh debounce lalu sinkron kembali lewat refetch berikutnya.
  useEffect(() => {
    const dataDate = dailyLogData?.date?.slice(0, 10);
    if (dataDate === selectedDate && saveTimerRef.current) return;
    if (!dailyLogData || dataDate === selectedDate) {
      // GELOMBANG 1: notes lama berformat HTML (era TipTap) dibersihkan
      // jadi teks polos — editor kini textarea controlled.
      setNotes(htmlToPlainText(dailyLogData?.notes || ''));
    } else {
      setNotes('');
    }
  }, [dailyLogData, selectedDate]);

  // ---- debounced save (notes only) ----
  const debouncedSave = useCallback(
    (patch: { notes?: string }) => {
      // M5-fix (catatan tanggal future): guard SEBELUM draft menjadi patch —
      // tanpa ini mengetik di tanggal future membuat DailyLog phantom + mood
      // marker kalender muncul di hari future (server daily-logs memang tidak
      // punya guard tanggal). Toast cukup sekali per kunjungan tanggal future.
      if (selectedDate > todayStr) {
        if (!futureToastRef.current) {
          futureToastRef.current = true;
          toast.error('Tidak bisa mencatat untuk tanggal yang akan datang');
        }
        return;
      }
      futureToastRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // BUG-19 fix: stash the pending patch (with the current selectedDate)
      // so the unmount handler can fire-and-forget it. Previously the timer
      // was just cancelled on unmount, losing the last <600ms of typing.
      pendingSaveRef.current = { date: selectedDate, ...patch };
      const timer = setTimeout(async () => {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (!pending) return;
        try {
          // Kontrak API: PUT partial-safe (fallback POST bila 405).
          const res = await saveDailyLog(pending);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          queryClient.invalidateQueries({ queryKey: ['daily-logs', pending.date] });
        } catch {
          toast.error('Gagal menyimpan catatan');
        } finally {
          // H2-fix (a): reset saveTimerRef SETELAH timer ini selesai (termasuk
          // save in-flight) — tanpa ini nilai timer lama (truthy) menggantung
          // selamanya, guard "debounce aktif" di efek sinkron notes memblokir
          // server→state selamanya → ganti tanggal = textarea kosong & 1
          // ketikan menimpa catatan tersimpan. Dijaga dengan pembanding
          // `=== timer` supaya finally timer LAMA tidak membatalkan ref timer
          // BARU yang dijadwalkan flush tanggal / ketikan berikutnya.
          if (saveTimerRef.current === timer) saveTimerRef.current = null;
        }
      }, 600);
      saveTimerRef.current = timer;
    },
    [selectedDate, todayStr, queryClient],
  );

  const handleNotesChange = useCallback(
    (html: string) => {
      setNotes(html);
      debouncedSave({ notes: html });
    },
    [debouncedSave],
  );

  // PHASE4-POLISH: visible-text length for the "X karakter" hint. The stored
  // notes are now HTML (TipTap), so the raw string length includes <p>/<ul>
  // tags etc. — which would be misleading. Strip tags to get the user-visible
  // length. Returns 0 for empty/whitespace-only content.
  const notesCharCount = useMemo(() => {
    if (!notes) return 0;
    // Quick + dirty tag stripper — sufficient for the count display only.
    // (For rendering, the TipTap editor handles its own HTML safely.)
    return notes.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length;
  }, [notes]);

  // ---- effects ----
  // BUG-19 fix (kini lewat flushPendingSave — H2): on unmount, fire-and-forget
  // any pending debounced notes save using `keepalive: true` so the request
  // completes after the component is gone. Previously the save was just
  // cancelled, silently dropping the user's last edits if they navigated
  // within the 600ms debounce window. flushPendingSave juga memperbarui cache
  // ['daily-logs', tanggal] optimistik supaya remount cepat tetap menampilkan
  // draft (bukan nilai server lama yang akan ditimpa ketikan berikutnya).
  useEffect(
    () => () => {
      flushPendingSave();
    },
    [flushPendingSave],
  );

  return { notes, handleNotesChange, notesCharCount };
}
