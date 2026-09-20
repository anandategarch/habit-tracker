// ---------------------------------------------------------------------------
// src/app/api/_lib/gym-photo-ensure.ts — ensure-DDL runtime tabel foto progres
// (Task 76: GymProgressPhoto — Bonus Gym Cerdas).
//
// Pola gym-set-ensure.ts (Task 74): token Turso produksi tak ada di sandbox →
// tabel dibuat lewat DDL idempoten saat route pertama dipanggil. DDL disalin
// verbatim dari sqlite_master hasil `prisma db push` (db/custom.db).
//
// Eksekusi via @libsql/client; cache Promise di globalThis → DDL hanya SEKALI
// per proses (bertahan lintas HMR reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "GymProgressPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pose" TEXT NOT NULL,
    "note" TEXT,
    "weightKg" REAL,
    "thumbBase64" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "GymProgressPhoto_dayKey_idx" ON "GymProgressPhoto"("dayKey")`,
];

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForGymPhotoDdl = globalThis as unknown as {
  __gymEnsurePhotoTablePromise?: Promise<void>;
};

async function runGymPhotoDdl(): Promise<void> {
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

/** Pastikan tabel foto progres ada (idempotent, di-cache per proses). */
export function ensureGymPhotoTable(): Promise<void> {
  if (!globalForGymPhotoDdl.__gymEnsurePhotoTablePromise) {
    globalForGymPhotoDdl.__gymEnsurePhotoTablePromise = runGymPhotoDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi.
      globalForGymPhotoDdl.__gymEnsurePhotoTablePromise = undefined;
      throw error;
    });
  }
  return globalForGymPhotoDdl.__gymEnsurePhotoTablePromise;
}
