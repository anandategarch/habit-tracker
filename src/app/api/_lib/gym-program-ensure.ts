// ---------------------------------------------------------------------------
// src/app/api/_lib/gym-program-ensure.ts — ensure-DDL runtime tabel program
// latihan gym (Task 75: GymProgram — Fase 4 Gym Cerdas).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// tabel baru tidak bisa di-push ke DB produksi lewat CLI. Solusi sama seperti
// gym-set-ensure.ts (Task 74): setiap route yang menyentuh tabel program
// memanggil ensureGymProgramTable() SEBELUM query Prisma. DDL `CREATE TABLE
// IF NOT EXISTS` identik dengan hasil `prisma db push` (db/custom.db) —
// tabel terbentuk otomatis saat API pertama kali dipanggil, lokal maupun
// Turso. Tanpa index: baris program sedikit (single-user), tak ada query
// per-kolom; hanya full-scan yang murah.
//
// Eksekusi via @libsql/client (bukan prisma.$executeRaw) — koneksi raw dengan
// url+token yang di-parse sama persis seperti db.ts. Cache Promise di
// globalThis → DDL hanya SEKALI per proses (bertahan lintas HMR reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

// DDL disalin verbatim dari `SELECT sql FROM sqlite_master` hasil
// `prisma db push` (db/custom.db) — hanya "CREATE TABLE" → "CREATE TABLE
// IF NOT EXISTS". Jangan ubah bentuk kolom/default supaya tetap
// byte-compatible dengan skema Prisma.
const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "GymProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📋',
    "daysJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
];

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForGymProgramDdl = globalThis as unknown as {
  __gymEnsureProgramTablePromise?: Promise<void>;
};

async function runGymProgramDdl(): Promise<void> {
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

/** Pastikan tabel program gym ada (idempotent, di-cache per proses). */
export function ensureGymProgramTable(): Promise<void> {
  if (!globalForGymProgramDdl.__gymEnsureProgramTablePromise) {
    globalForGymProgramDdl.__gymEnsureProgramTablePromise = runGymProgramDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForGymProgramDdl.__gymEnsureProgramTablePromise = undefined;
      throw error;
    });
  }
  return globalForGymProgramDdl.__gymEnsureProgramTablePromise;
}
