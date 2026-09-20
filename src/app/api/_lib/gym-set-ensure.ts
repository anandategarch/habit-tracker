// ---------------------------------------------------------------------------
// src/app/api/_lib/gym-set-ensure.ts — ensure-DDL runtime tabel jurnal set
// gym (Task 74: GymSetLog — Fase 3 Gym Cerdas).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// tabel baru tidak bisa di-push ke DB produksi lewat CLI. Solusi sama seperti
// gym-exercise-ensure.ts (Task 67): setiap route yang menyentuh tabel jurnal
// set memanggil ensureGymSetTables() SEBELUM query Prisma. DDL `CREATE TABLE
// IF NOT EXISTS` (+ unique & index) identik dengan hasil `prisma db push`
// (db/custom.db) — tabel terbentuk otomatis saat API pertama kali dipanggil,
// lokal maupun Turso.
//
// Eksekusi via @libsql/client (bukan prisma.$executeRaw) — koneksi raw dengan
// url+token yang di-parse sama persis seperti db.ts. Cache Promise di
// globalThis → DDL hanya SEKALI per proses (bertahan lintas HMR reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

// DDL disalin verbatim dari `SELECT sql FROM sqlite_master` hasil
// `prisma db push` (db/custom.db) — hanya "CREATE TABLE" → "CREATE TABLE
// IF NOT EXISTS" dan index diberi "IF NOT EXISTS" juga. Jangan ubah bentuk
// kolom/default supaya tetap byte-compatible dengan skema Prisma.
const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "GymSetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GymSetLog_zone_nameKey_dayKey_key" ON "GymSetLog"("zone", "nameKey", "dayKey")`,
  `CREATE INDEX IF NOT EXISTS "GymSetLog_zone_dayKey_idx" ON "GymSetLog"("zone", "dayKey")`,
];

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForGymSetDdl = globalThis as unknown as {
  __gymEnsureSetTablesPromise?: Promise<void>;
};

async function runGymSetDdl(): Promise<void> {
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

/** Pastikan tabel jurnal set gym ada (idempotent, di-cache per proses). */
export function ensureGymSetTables(): Promise<void> {
  if (!globalForGymSetDdl.__gymEnsureSetTablesPromise) {
    globalForGymSetDdl.__gymEnsureSetTablesPromise = runGymSetDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForGymSetDdl.__gymEnsureSetTablesPromise = undefined;
      throw error;
    });
  }
  return globalForGymSetDdl.__gymEnsureSetTablesPromise;
}
