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
