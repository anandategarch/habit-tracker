// ---------------------------------------------------------------------------
// src/app/api/_lib/gym-exercise-ensure.ts — ensure-DDL runtime tabel latihan
// gym kustom (Task 67: GymExerciseList + GymExercise).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// tabel baru tidak bisa di-push ke DB produksi lewat CLI (`turso:push`).
// Solusi sama seperti work-ensure.ts (Task 17-a): setiap route yang menyentuh
// tabel latihan gym memanggil ensureGymExerciseTables() SEBELUM query Prisma.
// Fungsi ini menjalankan `CREATE TABLE IF NOT EXISTS` (+ unique index) yang
// identik dengan DDL hasil `prisma db push` (db/custom.db) — jadi tabel
// terbentuk otomatis saat API pertama kali dipanggil, lokal maupun Turso.
//
// Eksekusi via @libsql/client (bukan prisma.$executeRaw) supaya DDL berjalan
// pada koneksi raw dengan url+token yang di-parse sama persis seperti db.ts.
//
// Cache Promise di globalThis → DDL hanya dijalankan SEKALI per proses
// (bertahan lintas HMR/turbopack route reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

// DDL disalin verbatim dari `SELECT sql FROM sqlite_master` hasil
// `prisma db push` (db/custom.db) — hanya "CREATE TABLE" → "CREATE TABLE
// IF NOT EXISTS" dan index diberi "IF NOT EXISTS" juga. Jangan ubah bentuk
// kolom/default supaya tetap byte-compatible dengan skema Prisma.
const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "GymExerciseList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "GymExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "amount" INTEGER NOT NULL DEFAULT 12,
    "unit" TEXT NOT NULL DEFAULT 'reps',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymExercise_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GymExerciseList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GymExerciseList_zone_key" ON "GymExerciseList"("zone")`,
];

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForGymDdl = globalThis as unknown as {
  __gymEnsureExerciseTablesPromise?: Promise<void>;
};

async function runGymDdl(): Promise<void> {
  const { url, authToken } = workLibsqlConfig();
  const client: Client = createClient({ url, authToken });
  try {
    for (const stmt of DDL_STATEMENTS) {
      await client.execute(stmt);
    }
  } finally {
    client.close();
  }
}

/** Pastikan tabel latihan gym kustom ada (idempotent, di-cache per proses). */
export function ensureGymExerciseTables(): Promise<void> {
  if (!globalForGymDdl.__gymEnsureExerciseTablesPromise) {
    globalForGymDdl.__gymEnsureExerciseTablesPromise = runGymDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForGymDdl.__gymEnsureExerciseTablesPromise = undefined;
      throw error;
    });
  }
  return globalForGymDdl.__gymEnsureExerciseTablesPromise;
}
