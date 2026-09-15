// ---------------------------------------------------------------------------
// src/app/api/_lib/transaction-ensure.ts — ensure-DDL runtime kolom
// Transaction.groupId (Task 60-f, audit 59-b3 MED).
//
// Kenapa ada: badge "Split" di daftar transaksi adalah dead-code — tipenya
// ada di frontend (tx.groupId) tapi TIDAK pernah ada kolomnya di schema dan
// tidak ada route yang mengisinya. Task 60-f menambahkan kolom nullable
// Transaction.groupId (satu id dibagi ke seluruh baris hasil pecahan split).
//
// Produksi (Turso) tidak bisa di-push dari sandbox → pola sama seperti
// habit-ensure.ts: route yang membaca baris Transaction PENUH (findMany /
// findUnique tanpa select parsial) atau menulis groupId memanggil
// ensureTransactionGroupId() SEBELUM query. Idempoten + di-cache per proses.
// ---------------------------------------------------------------------------
import { createClient, type Client } from '@libsql/client';
import { workLibsqlConfig } from '@/app/api/_lib/work-ensure';

const globalForTxDdl = globalThis as unknown as {
  __txEnsureGroupIdPromise?: Promise<void>;
};

async function runTransactionDdl(): Promise<void> {
  const { url, authToken } = workLibsqlConfig();
  const client: Client = createClient({ url, authToken });
  try {
    const info = await client.execute('PRAGMA table_info("Transaction")');
    const existing = new Set(info.rows.map((r) => String(r.name)));
    if (!existing.has('groupId')) {
      await client.execute(`ALTER TABLE "Transaction" ADD COLUMN "groupId" TEXT`);
    }
  } finally {
    client.close();
  }
}

/** Pastikan kolom Transaction.groupId ada (idempotent, di-cache per proses). */
export function ensureTransactionGroupId(): Promise<void> {
  if (!globalForTxDdl.__txEnsureGroupIdPromise) {
    globalForTxDdl.__txEnsureGroupIdPromise = runTransactionDdl().catch((error) => {
      globalForTxDdl.__txEnsureGroupIdPromise = undefined;
      throw error;
    });
  }
  return globalForTxDdl.__txEnsureGroupIdPromise;
}
