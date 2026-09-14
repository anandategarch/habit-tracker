// components/habit-tracker/use-habit-toggle.ts — toggle selesai/batal habit
// (biner) + stepper amount: optimistik, rollback, update cache bulan, confetti.
//
// Task 38 (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// urutan operasi, guard (M2 tanggal manual, M3 mirror completedAt, RACE,
// BUG-FIX-COMP-HIGH avoid, STREAK-TZ UTC-noon), dan deps useCallback identik.

import { useCallback, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jakartaNowIso } from '@/lib/timezone';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { computeStreak } from './daily-tracker-helpers';
import { parseSchedule } from '@/lib/habit-schedule';
import { milestoneForStreak, burstFromElement } from '@/lib/confetti';
import { toDateString, formatJakartaTime } from './daily-tracker-helpers';
import type { Habit, HabitLog } from './daily-tracker-types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface HabitToggleOptions {
  selectedDate: string;
  todayStr: string;
  queryClient: QueryClient;
  monthLogsCacheRef: MutableRefObject<Record<string, Record<string, HabitLog[]>>>;
  completionMapRef: MutableRefObject<Record<string, boolean>>;
  amountValueMapRef: MutableRefObject<Record<string, number>>;
  setCompletionMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  setCompletedAtMap: Dispatch<SetStateAction<Record<string, string>>>;
  setAmountValueMap: Dispatch<SetStateAction<Record<string, number>>>;
}

export interface HabitToggleApi {
  /** ID habit yang sedang dalam round-trip (untuk pulse kartu). */
  togglingIds: Set<string>;
  /** ID habit yang baru saja selesai (anim pop 700ms). */
  recentlyCompleted: Set<string>;
  /** Elemen pemicu completion — posisi asal confetti (pola BUG-5). */
  confettiElRef: MutableRefObject<HTMLElement | null>;
  handleSetConfettiEl: (el: HTMLElement | null) => void;
  toggleHabit: (habit: Habit, completedAt: string | null, dateOverride?: string) => Promise<void>;
  handleAmountDelta: (
    habit: Habit,
    delta: number,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => Promise<void>;
}

export function useHabitToggle(opts: HabitToggleOptions): HabitToggleApi {
  const {
    selectedDate,
    todayStr,
    queryClient,
    monthLogsCacheRef,
    completionMapRef,
    amountValueMapRef,
    setCompletionMap,
    setCompletedAtMap,
    setAmountValueMap,
  } = opts;

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());

  // ---- handlers ----
  // Ref to track the element that triggered a habit completion (for confetti position).
  // Set in handleHabitCheck, read in toggleHabit after successful API response.
  const confettiElRef = useRef<HTMLElement | null>(null);

  // BUGHUNT-47 (47-c #4): guard in-flight per-habit. Tap cepat 2× badan kartu
  // (jaringan lambat) mengirim dua POST berlawanan; bila urutan respons ke
  // client tidak sama dengan urutan pemrosesan server, checkbox bisa beda
  // permanen dengan DB. Klik kedua saat round-trip pertama masih berjalan
  // kini diabaikan (checkbox/stepper sudah disabled — badan kartu belum).
  const inFlightRef = useRef<Set<string>>(new Set());

  // PERF-REACT-1 fix: toggleHabit is declared BEFORE handleHabitCheck and
  // handleTimeDialogSubmit (which call it) so the useCallback deps arrays
  // can reference it without temporal-dead-zone errors. Reads
  // `completionMap` via `completionMapRef.current` (not directly) so the
  // callback identity stays stable across toggles — this is what lets
  // React.memo on HabitCard actually skip re-renders for untouched cards.
  const toggleHabit = useCallback(
    async (habit: Habit, completedAt: string | null, dateOverride?: string) => {
      const habitId = habit.id;
      // BUGHUNT-47 (47-c #4): lewati bila toggle habit ini masih dalam
      // round-trip (double-tap badan kartu / klik simultan).
      if (inFlightRef.current.has(habitId)) return;
      inFlightRef.current.add(habitId);
      try {
      // M2-fix (tanggal manual diabaikan): dialog waktu membangun completedAt
      // dari manualDate, tapi dulu POST selalu memakai selectedDate → log masuk
      // hari salah. Tanggal manual kini diteruskan sebagai override (default:
      // selectedDate). String kosong dianggap tidak ada override.
      const logDate = dateOverride || selectedDate;
      const isViewDate = logDate === selectedDate;
      // Optimi UI hanya relevan untuk tanggal yang sedang DILIHAT — log manual
      // untuk hari lain tidak boleh mengubah checkbox hari ini. Jalur dialog
      // (satu-satunya sumber override) selalu "menyelesaikan" habit.
      const next = isViewDate
        ? !(completionMapRef.current[habitId] ?? false)
        : true;

      if (isViewDate) {
        setCompletionMap((p) => ({ ...p, [habitId]: next }));
      }
      setTogglingIds((p) => new Set(p).add(habitId));

      if (next && isViewDate) {
        setRecentlyCompleted((p) => new Set(p).add(habitId));
        setTimeout(() => {
          setRecentlyCompleted((p) => {
            const s = new Set(p);
            s.delete(habitId);
            return s;
          });
        }, 700);
      }

      try {
        const res = await fetch(`/api/habits/${habitId}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // M2: tanggal log = tanggal manual (bila ada), bukan tanggal tampil.
            date: logDate,
            completed: next,
            completedAt: next ? completedAt : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        // M3 (lanjutan): log hasil upsert dari server dipakai sebagai sumber
        // kebenaran cache/tampilan — untuk toggle SELESAI tanpa completedAt
        // eksplisit, server-lah yang mengisi completedAt (mirror create), jadi
        // UI "Selesai HH.mm" langsung akurat tanpa menunggu refetch.
        const savedLog = (await res.json().catch(() => null)) as HabitLog | null;
        const savedCompletedAt =
          next ? (savedLog?.completedAt ?? completedAt) : null;

        // update month cache — bulan & tanggal pakai logDate (M2); cache bulan
        // menyimpan gabungan prev+current (M4) sehingga update tanggal manual
        // tetap menemukan slot yang benar.
        const month = logDate.slice(0, 7);
        const cache = monthLogsCacheRef.current[month];
        if (cache) {
          const logs = cache[habitId] || [];
          const idx = logs.findIndex((l) => toDateString(l.date) === logDate);
          const entry = {
            id: savedLog?.id ?? '',
            habitId,
            // STREAK-TZ-class fix: local noon ("T12:00:00") lands on the
            // PREVIOUS Jakarta day on browsers west of UTC — the optimistic
            // cache entry was then mis-keyed by toDateString() (jakartaDateKey)
            // and the post-toggle streak/completion read one day off until a
            // refetch. UTC noon always maps to the same Jakarta day.
            date: new Date(logDate + 'T12:00:00Z').toISOString(),
            completed: next,
            value: savedLog?.value ?? 1,
            completedAt: savedCompletedAt,
          };
          if (idx >= 0) {
            logs[idx] = { ...logs[idx], ...entry };
          } else {
            logs.push(entry);
          }
        }

        if (isViewDate) {
          if (next && savedCompletedAt) {
            setCompletedAtMap((p) => ({
              ...p,
              [habitId]: formatJakartaTime(savedCompletedAt),
            }));
          } else {
            setCompletedAtMap((p) => {
              const np = { ...p };
              delete np[habitId];
              return np;
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
        // CONNECTED-APP: ekosistem ikut tahu habit baru saja selesai —
        // kalender Riwayat (dots), analisis waktu, streak di dialog meta,
        // insight mingguan, dan heatmap jam (semuanya membaca data yang
        // berubah karena completion ini).
        queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
        queryClient.invalidateQueries({ queryKey: ['time-analysis'] });
        queryClient.invalidateQueries({ queryKey: ['habit-meta'] });
        queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
        queryClient.invalidateQueries({ queryKey: ['hourly-consistency'] });

        if (next) {
          // BUG-FIX-COMP-HIGH #1: For "avoid" habits (habitType === 'avoid'),
          // checking the box records a RELAPSE — not a success. Do NOT fire
          // the success toast, confetti burst, or milestone celebration here.
          // Show a gentle relapse message instead. Only normal/amount habits
          // get the success path below (toast.success + confetti + milestone).
          //
          // Captured as a local const before the branch so TS doesn't narrow
          // `habit.habitType` to `"normal" | "amount"` inside the else-arm
          // (which would make `habit.habitType === 'avoid'` an "unintentional
          // comparison" error TS2367).
          const isAvoid = habit.habitType === 'avoid';
          if (isAvoid) {
            toast.error('Kambuh tercatat. Jangan menyerah! 💪');
            confettiElRef.current = null;
          } else {
            // ── Confetti — ONLY after successful API response ──
            // BUG-1 fix: the month cache was already mutated above to include
            // today's completion, so computeStreak already counts today. The
            // previous `newStreak = currentStreak + 1` double-counted today,
            // firing milestone confetti (7/30/100/365) one day early. Now
            // `newStreak = currentStreak`.
            // BUG-18 fix: when no cache exists, return 0 (not _count.logs which
            // was the total log count — completely unrelated to a streak).
            // BUG-FIX-COMP-HIGH #2: pass the options object to computeStreak so
            // the streak is computed correctly for any habit type. For
            // normal/amount habits (the only ones reaching this branch — avoid
            // habits were short-circuited above) `invert` is false; the call
            // signature is still passed explicitly for safety and forward-
            // compatibility (so a future refactor that re-enables the success
            // path for avoid habits doesn't silently regress).
            const currentStreak = cache
              ? computeStreak(cache[habitId] || [], logDate, {
                  invert: isAvoid,
                  startDate: habit.startDate,
                  onVacation: !!habit.vacationMode,
                  schedule: parseSchedule(habit.scheduleJson),
                })
              : 0;
            const newStreak = currentStreak;
            const el = confettiElRef.current;

            const milestone = milestoneForStreak(newStreak);

            // Task 44 "completion harus memuaskan": XP yang BARU didapat
            // ditampilkan langsung di toast (sebelumnya XP tidak pernah
            // terlihat — feedback jadi flat). Milestone streak mendapat
            // pesan lebih spesial + confetti rainbow.
            const xp = xpForHabit(habit);
            toast.success(
              milestone
                ? `Streak ${newStreak} hari! +${xp} XP 🔥`
                : `Habit selesai! +${xp} XP 🎉`,
            );

            if (milestone) {
              // Milestone streak — burst rainbow besar dari elemen asal
              // (perayaan full-screen berbasis tier lama sudah tidak ada di
              // lib/confetti — burst ganda dipakai sebagai gantinya).
              burstFromElement(el, { count: 60, spread: 110, rainbow: true });
            } else {
              // Regular completion — burst from the clicked element
              burstFromElement(el, { count: 20 });
            }
            // Clear the ref so a future toggle-OFF doesn't reuse a stale element.
            confettiElRef.current = null;
          }
        }
      } catch (e) {
        // Rollback optimistik hanya untuk tanggal yang dilihat (M2) — log
        // manual hari lain tidak pernah mengubah state UI hari ini.
        if (isViewDate) {
          setCompletionMap((p) => ({ ...p, [habitId]: !next }));
        }
        toast.error(e instanceof Error ? e.message : 'Gagal memperbarui habit');
        confettiElRef.current = null;
      } finally {
        setTogglingIds((p) => {
          const s = new Set(p);
          s.delete(habitId);
          return s;
        });
      }
      } finally {
        // BUGHUNT-47 (47-c #4): lepas guard in-flight apa pun hasil round-trip.
        inFlightRef.current.delete(habitId);
      }
    },
    [selectedDate, queryClient, completionMapRef, monthLogsCacheRef, setCompletionMap, setCompletedAtMap],
  );

  // ── GELOMBANG 1: stepper habit amount ─────────────────────────────
  // Habit amount (habitType 'amount') dicatat sebagai value 0..target;
  // completed = value >= target. completedAt di-set saat PERTAMA mencapai
  // target (jakartaNowIso) dan di-nol-kan saat turun dari target.
  const handleAmountDelta = useCallback(
    async (
      habit: Habit,
      delta: number,
      event?: React.MouseEvent | React.KeyboardEvent,
    ) => {
      if (selectedDate > todayStr) {
        toast.error('Tidak bisa mencatat habit untuk tanggal yang akan datang');
        return;
      }
      const habitId = habit.id;
      const target = Math.max(1, habit.target || 1);
      const current = Math.round(amountValueMapRef.current[habitId] ?? 0);
      const nextValue = Math.min(target, Math.max(0, Math.round(current + delta)));
      if (nextValue === current) return; // sudah di batas clamp
      const wasCompleted = !!(completionMapRef.current[habitId] ?? false);
      const nextCompleted = nextValue >= target;

      if (event && 'currentTarget' in event) {
        confettiElRef.current = event.currentTarget as HTMLElement;
      }

      // Optimistic: nilai amount + status selesai + pop anim.
      setAmountValueMap((p) => ({ ...p, [habitId]: nextValue }));
      setCompletionMap((p) => ({ ...p, [habitId]: nextCompleted }));
      setTogglingIds((p) => new Set(p).add(habitId));
      if (nextCompleted && !wasCompleted) {
        setRecentlyCompleted((p) => new Set(p).add(habitId));
        setTimeout(() => {
          setRecentlyCompleted((p) => {
            const s = new Set(p);
            s.delete(habitId);
            return s;
          });
        }, 700);
      }

      try {
        const body: {
          date: string;
          completed: boolean;
          value: number;
          completedAt?: string | null;
        } = {
          date: selectedDate,
          completed: nextCompleted,
          value: nextValue,
        };
        if (nextCompleted && !wasCompleted) {
          body.completedAt = jakartaNowIso(); // pertama kali capai target
        } else if (!nextCompleted) {
          body.completedAt = null; // turun dari target → hapus
        }
        const res = await fetch(`/api/habits/${habitId}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        // update month cache (sumber streak & 7-hari flip)
        const month = selectedDate.slice(0, 7);
        const cache = monthLogsCacheRef.current[month];
        if (cache) {
          const logs = cache[habitId] || [];
          const idx = logs.findIndex((l) => toDateString(l.date) === selectedDate);
          const entry: HabitLog = {
            id: '',
            habitId,
            // UTC noon — selalu jatuh di hari Jakarta yang sama (pola lama).
            date: new Date(selectedDate + 'T12:00:00Z').toISOString(),
            completed: nextCompleted,
            value: nextValue,
            completedAt:
              typeof body.completedAt === 'string' ? body.completedAt : null,
          };
          if (idx >= 0) {
            logs[idx] = { ...logs[idx], ...entry };
          } else {
            logs.push(entry);
          }
        }

        if (nextCompleted && typeof body.completedAt === 'string') {
          setCompletedAtMap((p) => ({
            ...p,
            [habitId]: formatJakartaTime(body.completedAt as string),
          }));
        } else if (!nextCompleted) {
          setCompletedAtMap((p) => {
            const np = { ...p };
            delete np[habitId];
            return np;
          });
        }

        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
        // CONNECTED-APP: ekosistem ikut tahu habit baru saja selesai —
        // kalender Riwayat (dots), analisis waktu, streak di dialog meta,
        // insight mingguan, dan heatmap jam (semuanya membaca data yang
        // berubah karena completion ini).
        queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
        queryClient.invalidateQueries({ queryKey: ['time-analysis'] });
        queryClient.invalidateQueries({ queryKey: ['habit-meta'] });
        queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
        queryClient.invalidateQueries({ queryKey: ['hourly-consistency'] });

        if (nextCompleted && !wasCompleted) {
          // Task 44: +XP tampil juga di milestone amount (konsisten toggle biner).
          toast.success(`Target tercapai! +${xpForHabit(habit)} XP 🎉 (${habit.name})`);
          const currentStreak = cache
            ? computeStreak(cache[habitId] || [], selectedDate, {
                startDate: habit.startDate,
                onVacation: !!habit.vacationMode,
                schedule: parseSchedule(habit.scheduleJson),
              })
            : 0;
          const milestone = milestoneForStreak(currentStreak);
          if (milestone) {
            burstFromElement(confettiElRef.current, {
              count: 60,
              spread: 110,
              rainbow: true,
            });
          } else {
            burstFromElement(confettiElRef.current, { count: 20 });
          }
          confettiElRef.current = null;
        }
      } catch (e) {
        // Rollback optimistic.
        setAmountValueMap((p) => ({ ...p, [habitId]: current }));
        setCompletionMap((p) => ({ ...p, [habitId]: wasCompleted }));
        toast.error(e instanceof Error ? e.message : 'Gagal memperbarui progres');
        confettiElRef.current = null;
      } finally {
        setTogglingIds((p) => {
          const s = new Set(p);
          s.delete(habitId);
          return s;
        });
      }
    },
    [selectedDate, todayStr, queryClient, amountValueMapRef, completionMapRef, monthLogsCacheRef, setAmountValueMap, setCompletionMap, setCompletedAtMap],
  );

  // PERF-REACT-1 fix: stable callback wrappers for the inline arrow functions
  // previously passed to HabitCard (onSetConfettiEl, onOpenAnalysis). Without
  // useCallback, those arrows created new function identities every render,
  // defeating React.memo on HabitCard. Both wrappers have empty deps because
  // they only call ref mutation / setState setter (both stable for the
  // lifetime of the component).
  const handleSetConfettiEl = useCallback((el: HTMLElement | null) => {
    confettiElRef.current = el;
  }, []);

  return {
    togglingIds,
    recentlyCompleted,
    confettiElRef,
    handleSetConfettiEl,
    toggleHabit,
    handleAmountDelta,
  };
}
