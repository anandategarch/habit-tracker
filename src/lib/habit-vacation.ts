// lib/habit-vacation.ts — riwayat liburan habit (Task 60-c, audit 59-b2 HIGH).
//
// MASALAH: mode liburan lama hanya membekukan streak SAAT vacationMode aktif.
// Begitu vacationUntil lewat (expireHabitVacations → mode false), hari-hari
// libur berubah jadi "miss" → kuota hari aman (2/bulan) cepat habis → streak
// jatuh ke 0 — padahal UI menjanjikan "streak menyala kembali". Solusi: setiap
// liburan dicatat sebagai INTERVAL [start..until] pada Habit.vacationIntervals
// (JSON string, pola kolom-JSON seperti scheduleJson/milestones). Hitungan
// streak (tracker, dashboard, ai-insights) memperlakukan hari dalam interval
// sebagai NETRAL: tidak menambah streak, tidak putus, tidak makan hari aman —
// PERMANEN, bahkan setelah liburan berakhir.
//
// Format: [{"s":"2025-03-01","u":"2025-03-07"}] — "u" null = interval masih
// TERBUKA (mode aktif tanpa tanggal akhir). Parser toleran (menerima kunci
// panjang start/until), di-cap 50 interval, entri rusak dibuang senyap.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INTERVALS = 50;

export interface VacationInterval {
  /** YMD mulai liburan (inklusif). */
  start: string;
  /** YMD akhir liburan (inklusif); null = masih terbuka. */
  until: string | null;
}

/** Parse kolom vacationIntervals → daftar interval (toleran; rusak → kosong). */
export function parseVacationIntervals(raw: string | null | undefined): VacationInterval[] {
  if (!raw || typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: VacationInterval[] = [];
  for (const item of parsed) {
    if (out.length >= MAX_INTERVALS) break;
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const s = typeof rec.s === 'string' ? rec.s : typeof rec.start === 'string' ? rec.start : null;
    const u =
      rec.u === null || rec.u === undefined
        ? typeof rec.until === 'string'
          ? rec.until
          : null
        : typeof rec.u === 'string'
          ? rec.u
          : null;
    if (!s || !YMD_RE.test(s)) continue;
    if (u !== null && !YMD_RE.test(u)) continue;
    out.push({ start: s, until: u });
  }
  return out;
}

/** Serialize daftar interval → string JSON kolom (rapat, di-cap 50). */
export function serializeVacationIntervals(list: VacationInterval[]): string {
  return JSON.stringify(list.slice(0, MAX_INTERVALS).map((v) => ({ s: v.start, u: v.until })));
}

/**
 * Predikat "hari ini libur?" dari daftar interval.
 * `openEndYmd` membatasi interval TERBUKA (until null): untuk walk streak yang
 * berakhir di endYmd, operkan endYmd/today — hari setelahnya tak relevan.
 */
export function vacationDayPredicate(
  intervals: VacationInterval[],
  openEndYmd?: string,
): (ymd: string) => boolean {
  const closed = intervals.filter((v): v is { start: string; until: string } => v.until !== null);
  const open = intervals.filter((v) => v.until === null);
  return (ymd: string) => {
    for (const v of closed) {
      if (ymd >= v.start && ymd <= v.until) return true;
    }
    for (const v of open) {
      const end = openEndYmd ?? v.start;
      if (ymd >= v.start && ymd <= end) return true;
    }
    return false;
  };
}

/**
 * Tutup interval terbuka/di masa depan pada batas `clampYmd` (dipakai saat user
 * mematikan mode liburan manual): interval yang belum berakhir dipangkas
 * sampai clamp; interval yang jadi kosong (start > clamp) dibuang.
 * Interval yang sudah selesai di masa lalu tidak disentuh.
 */
export function closeOpenVacationIntervals(list: VacationInterval[], clampYmd: string): VacationInterval[] {
  return list
    .map((v) => {
      if (v.until === null || v.until > clampYmd) return { start: v.start, until: clampYmd };
      return v;
    })
    .filter((v) => v.start <= (v.until as string));
}

/** Perbarui tanggal akhir interval TERBUKA terakhir (edit "sampai" saat mode masih aktif). */
export function setLastOpenVacationUntil(list: VacationInterval[], until: string | null): VacationInterval[] {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].until === null) {
      list[i] = { start: list[i].start, until };
      return list;
    }
  }
  // Tidak ada interval terbuka (mis. habit lama) → anggap perubahan "sampai"
  // sebagai interval baru yang dibuka dari sekarang? Tidak — pemanggil sudah
  // menangani transisi mode; di sini cukup kembalikan apa adanya.
  return list;
}
