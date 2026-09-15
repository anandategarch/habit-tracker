// ---------------------------------------------------------------------------
// src/app/api/_lib/habit-ensure.ts — ensure-DDL runtime kolom Habit baru
// (Task 36: targetDays/graduatedAt · Task 37: scheduleJson).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// kolom baru Habit tidak bisa di-push ke DB produksi lewat CLI
// (`turso:push`). Solusi sama seperti work-ensure.ts (Task 17-a):
// setiap route yang menyentuh tabel Habit memanggil ensureHabitGraduation()
// SEBELUM query Prisma. Fungsi ini memeriksa PRAGMA table_info lalu menjalankan
// ALTER TABLE ADD COLUMN hanya bila kolom belum ada — idempoten, aman lokal
// (db push sudah menambahkan kolom → no-op) maupun Turso.
//
// SQLite tidak punya "ADD COLUMN IF NOT EXISTS", jadi cek PRAGMA dulu.
// Eksekusi via @libsql/client (koneksi raw dengan url+token yang di-parse
// sama persis seperti db.ts / work-ensure.ts).
//
// Cache Promise di level globalThis → DDL hanya dijalankan SEKALI per proses.
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';
import { db } from '@/lib/db';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';
import { serializeVacationIntervals } from '@/lib/habit-vacation';

const NEW_COLUMNS: { name: string; ddl: string }[] = [
  {
    name: 'targetDays',
    ddl: `ALTER TABLE "Habit" ADD COLUMN "targetDays" INTEGER`,
  },
  {
    name: 'graduatedAt',
    ddl: `ALTER TABLE "Habit" ADD COLUMN "graduatedAt" DATETIME`,
  },
  {
    name: 'scheduleJson',
    ddl: `ALTER TABLE "Habit" ADD COLUMN "scheduleJson" TEXT`,
  },
  {
    // CONNECTED-APP (Task 49): Habit.goalId — link habit → tujuan (nullable).
    name: 'goalId',
    ddl: `ALTER TABLE "Habit" ADD COLUMN "goalId" TEXT`,
  },
  {
    // Task 60-c (audit 59-b2 HIGH): Habit.vacationIntervals — riwayat interval
    // liburan JSON supaya hari libur NETRAL permanen di hitungan streak
    // ("streak menyala kembali" setelah libur, bukan putus ke 0).
    name: 'vacationIntervals',
    ddl: `ALTER TABLE "Habit" ADD COLUMN "vacationIntervals" TEXT`,
  },
];

const globalForHabitDdl = globalThis as unknown as {
  __habitEnsureGraduationPromise?: Promise<void>;
};

async function runHabitDdl(): Promise<void> {
  const { url, authToken } = workLibsqlConfig();
  const client: Client = createClient({ url, authToken });
  try {
    const info = await client.execute('PRAGMA table_info("Habit")');
    const existing = new Set(info.rows.map((r) => String(r.name)));
    for (const col of NEW_COLUMNS) {
      if (existing.has(col.name)) continue;
      await client.execute(col.ddl);
    }
  } finally {
    client.close();
  }
}

/** Pastikan kolom targetDays/graduatedAt/scheduleJson ada (idempotent, di-cache per proses). */
export function ensureHabitGraduation(): Promise<void> {
  if (!globalForHabitDdl.__habitEnsureGraduationPromise) {
    globalForHabitDdl.__habitEnsureGraduationPromise = runHabitDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForHabitDdl.__habitEnsureGraduationPromise = undefined;
      throw error;
    });
  }
  return globalForHabitDdl.__habitEnsureGraduationPromise;
}

/** BUGHUNT-47 (47-c #1): matikan mode liburan yang sudah LEWAT masa
 *  berlakunya (vacationUntil < hari ini Jakarta). Janji UI form habit:
 *  "mode liburan otomatis nonaktif dan habit kembali ditrack normal" —
 *  dulunya vacationUntil disimpan tapi TIDAK PERNAH dibaca → habit tetap
 *  berbadge 🏖 Libur & dikecualikan dari KPI tracker/dashboard selamanya
 *  sampai dimatikan manual. Dipanggil dari route baca habit utama
 *  (GET /api/habits + GET /api/dashboard) — idempoten & murah: updateMany
 *  hanya menyentuh baris libur yang benar-benar kedaluwarsa.
 *
 * Task 60-c (audit 59-b2 HIGH): sebelum mematikan mode, liburan yang sedang
 *  berjalan DIBUKUKAN sebagai interval permanen (Habit.vacationIntervals) —
 *  tanpa ini hari-hari libur berubah jadi miss begitu mode mati dan streak
 *  jatuh ke 0 (janji "streak menyala kembali" tidak pernah ditepati).
 *  Start interval disintesis dari LOG SELESAI TERAKHIR + 1 (persis perilaku
 *  beku yang selama ini dipakai tracker saat mode aktif); habit tanpa log →
 *  start = hari ini (interval kosong — streak memang 0). Hanya menyentuh
 *  baris mode-on TANPA interval tercatat (habit pra-Task 60) — idempoten. */
export async function expireHabitVacations(): Promise<void> {
  const todayStart = dateFromYMD(jakartaDateString());
  const todayYmd = jakartaDateString();

  // Task 60-c: bukukan dulu liburan legacy yang masih berjalan (SEBELUM mode
  // dimatikan) supaya intervalnya permanen saat kadaluarsa.
  const legacy = await db.habit.findMany({
    where: { vacationMode: true, vacationIntervals: null },
    select: { id: true, vacationUntil: true },
  });
  for (const h of legacy) {
    // Start = log completed terakhir + 1 hari (ekor beku tracker), fallback
    // hari ini. Until = tanggal akhir tersimpan (null = terbuka).
    const lastLog = await db.habitLog.findFirst({
      where: { habitId: h.id, completed: true },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    const lastYmd = lastLog ? jakartaDateString(lastLog.date as Date) : null;
    const start = lastYmd ? jakartaDateString(new Date(dateFromYMD(lastYmd).getTime() + 86_400_000)) : todayYmd;
    const until = h.vacationUntil ? jakartaDateString(h.vacationUntil as Date) : null;
    await db.habit.update({
      where: { id: h.id },
      data: { vacationIntervals: serializeVacationIntervals([{ start, until }]) },
    });
  }

  await db.habit.updateMany({
    where: {
      vacationMode: true,
      vacationUntil: { not: null, lt: todayStart },
    },
    data: { vacationMode: false },
  });
}
