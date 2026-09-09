// ---------------------------------------------------------------------------
// src/app/api/_lib/work-ensure.ts — ensure-DDL runtime untuk Meja Kerja (Task 17-a).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// skema Meja Kerja tidak bisa di-push ke DB produksi lewat CLI. Solusi: setiap
// route /api/work* memanggil ensureWorkTables() SEBELUM query Prisma. Fungsi
// ini menjalankan `CREATE TABLE IF NOT EXISTS` (+ unique index) yang identik
// dengan DDL hasil `prisma db push` — jadi tabel terbentuk sendiri otomatis
// saat API pertama kali dipanggil di lingkungan mana pun (lokal maupun Turso).
//
// Eksekusi via @libsql/client (bukan prisma.$executeRaw) supaya DDL berjalan
// pada koneksi raw dengan url+token yang di-parse sama persis seperti db.ts.
//
// Cache Promise di level modul → DDL hanya dijalankan SEKALI per proses.
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';

// DDL disalin verbatim dari `SELECT sql FROM sqlite_master` hasil
// `prisma db push` (db/custom.db) — hanya "CREATE TABLE" → "CREATE TABLE
// IF NOT EXISTS" dan index diberi "IF NOT EXISTS" juga. Jangan ubah bentuk
// kolom/default supaya tetap byte-compatible dengan skema Prisma.
const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "WorkRoutine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL DEFAULT 'pagi',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "WorkRoutineLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkRoutineLog_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "WorkRoutine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS "WorkTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dayKey" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "WorkNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "tag" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkRoutineLog_routineId_dayKey_key" ON "WorkRoutineLog"("routineId", "dayKey")`,
];

// Parse env persis seperti src/lib/db.ts:
//  * DATABASE_URL = file:… (lokal) | libsql://… (Turso)
//  * token: ?authToken= tertanam di URL meng-override DATABASE_AUTH_TOKEN.
export function workLibsqlConfig(): { url: string; authToken?: string } {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      'DATABASE_URL belum diset — set file:… (lokal) atau libsql://… + DATABASE_AUTH_TOKEN (Turso/Vercel).'
    );
  }
  let url = rawUrl;
  let authToken = process.env.DATABASE_AUTH_TOKEN;
  if (rawUrl.includes('?authToken=')) {
    const parts = rawUrl.split('?authToken=');
    url = parts[0];
    authToken = parts[1] || authToken;
  }
  return { url, authToken };
}

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForWorkDdl = globalThis as unknown as {
  __workEnsureTablesPromise?: Promise<void>;
};

async function runWorkDdl(): Promise<void> {
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

/** Pastikan 4 tabel Meja Kerja ada (DDL idempotent, di-cache sekali per proses). */
export function ensureWorkTables(): Promise<void> {
  if (!globalForWorkDdl.__workEnsureTablesPromise) {
    globalForWorkDdl.__workEnsureTablesPromise = runWorkDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForWorkDdl.__workEnsureTablesPromise = undefined;
      throw error;
    });
  }
  return globalForWorkDdl.__workEnsureTablesPromise;
}
