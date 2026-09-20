// ---------------------------------------------------------------------------
// src/app/api/_lib/gym-cardio-ensure.ts — ensure-DDL runtime tabel kardio
// (Task 76: GymCardioLog — Bonus Gym Cerdas).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// tabel baru tidak bisa di-push ke DB produksi lewat CLI. Solusi sama seperti
// gym-set-ensure.ts (Task 74): setiap route yang menyentuh tabel kardio
// memanggil ensureGymCardioTable() SEBELUM query Prisma. DDL `CREATE TABLE
// IF NOT EXISTS` (+ index) identik dengan hasil `prisma db push`
// (db/custom.db) — disalin verbatim dari sqlite_master.
//
// Eksekusi via @libsql/client (bukan prisma.$executeRaw) — koneksi raw dengan
// url+token yang di-parse sama persis seperti db.ts. Cache Promise di
// globalThis → DDL hanya SEKALI per proses (bertahan lintas HMR reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "GymCardioLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "distanceKm" REAL,
    "dayKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "GymCardioLog_dayKey_idx" ON "GymCardioLog"("dayKey")`,
  `CREATE INDEX IF NOT EXISTS "GymCardioLog_kind_dayKey_idx" ON "GymCardioLog"("kind", "dayKey")`,
];

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForGymCardioDdl = globalThis as unknown as {
  __gymEnsureCardioTablePromise?: Promise<void>;
};

async function runGymCardioDdl(): Promise<void> {
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

/** Pastikan tabel kardio ada (idempotent, di-cache per proses). */
export function ensureGymCardioTable(): Promise<void> {
  if (!globalForGymCardioDdl.__gymEnsureCardioTablePromise) {
    globalForGymCardioDdl.__gymEnsureCardioTablePromise = runGymCardioDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForGymCardioDdl.__gymEnsureCardioTablePromise = undefined;
      throw error;
    });
  }
  return globalForGymCardioDdl.__gymEnsureCardioTablePromise;
}
