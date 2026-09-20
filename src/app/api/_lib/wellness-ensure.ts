// ---------------------------------------------------------------------------
// src/app/api/_lib/wellness-ensure.ts — ensure-DDL runtime kolom Tubuh & Gizi
// (Task 73, Fase 2: waterGlasses / proteinGram / weightKg pada DailyLog).
//
// Kenapa ada file ini? Token Turso produksi TIDAK tersedia di sandbox, jadi
// kolom baru tidak bisa di-push ke DB produksi lewat CLI (`turso:push`).
// Solusi sama seperti work-ensure / gym-exercise-ensure / habit-ensure
// (pola 60-c): setiap route /api/wellness memanggil ensureWellnessColumns()
// SEBELUM query Prisma. Fungsi ini menjalankan ALTER TABLE ADD COLUMN yang
// identik dengan hasil `prisma db push` — idempoten (kolom sudah ada →
// dilewati senyap), jadi skema terbentuk otomatis saat API pertama kali
// dipanggil, lokal maupun Turso.
//
// Eksekusi via @libsql/client pada koneksi raw (url+token diparse sama
// persis seperti db.ts) — bukan prisma.$executeRaw.
//
// Cache Promise di globalThis → DDL hanya dijalankan SEKALI per proses
// (bertahan lintas HMR/turbopack route reload).
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

/** Nama kolom yang harus ada pada tabel DailyLog (Task 73). */
const WELLNESS_COLUMNS = [
  { column: 'waterGlasses', ddl: `ALTER TABLE "DailyLog" ADD COLUMN "waterGlasses" INTEGER` },
  { column: 'proteinGram', ddl: `ALTER TABLE "DailyLog" ADD COLUMN "proteinGram" INTEGER` },
  { column: 'weightKg', ddl: `ALTER TABLE "DailyLog" ADD COLUMN "weightKg" REAL` },
] as const;

// Cache di globalThis supaya bertahan lintas HMR/turbopack route reload.
const globalForWellnessDdl = globalThis as unknown as {
  __wellnessEnsureColumnsPromise?: Promise<void>;
};

async function runWellnessDdl(): Promise<void> {
  const { url, authToken } = workLibsqlConfig();
  const client: Client = createClient({ url, authToken });
  try {
    // Daftar kolom yang sudah ada → ALTER hanya untuk yang belum (SQLite
    // tidak punya "ADD COLUMN IF NOT EXISTS" — cek pragma_table_info).
    const existing = new Set<string>(
      (
        await client.execute(`SELECT name FROM pragma_table_info('DailyLog')`)
      ).rows.map((r) => String(r.name)),
    );
    for (const { column, ddl } of WELLNESS_COLUMNS) {
      if (existing.has(column)) continue;
      await client.execute(ddl);
    }
  } finally {
    client.close();
  }
}

/** Pastikan kolom wellness DailyLog ada (idempotent, di-cache per proses). */
export function ensureWellnessColumns(): Promise<void> {
  if (!globalForWellnessDdl.__wellnessEnsureColumnsPromise) {
    globalForWellnessDdl.__wellnessEnsureColumnsPromise = runWellnessDdl().catch((error) => {
      // Reset cache saat gagal supaya request berikutnya mencoba lagi
      // (misal koneksi Turso blip sementara).
      globalForWellnessDdl.__wellnessEnsureColumnsPromise = undefined;
      throw error;
    });
  }
  return globalForWellnessDdl.__wellnessEnsureColumnsPromise;
}
