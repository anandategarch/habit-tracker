// Migrasi data user: SQLite lokal (db/custom.db) → database Turso (libsql://).
//
// Dipakai SATU KALI saat pindah dari sandbox/lokal ke Turso (atau ulang kapan pun —
// idempoten: remote di-DELETE lalu di-INSERT ulang sebagai cermin persis dari lokal).
//
// Prasyarat:
//   1. Schema remote sudah tersinkron:  TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… bun run turso:push
//   2. Data sumber ada di SQLite lokal (default file:/home/z/my-project/db/custom.db).
//
// Cara pakai:
//   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="eyJ…" bun run turso:migrate-data
//   (uji lokal tanpa Turso: TURSO_DATABASE_URL="file:/tmp/target.db" bun run turso:migrate-data)
//
// Catatan desain:
//  * Semua nilai disalin mentah (epoch-ms utk DateTime, string, number) → semantics
//    identik dengan yang ditulis Prisma+libsql adapter di sumber.
//  * "Transaction" punya self-FK transferPairId (pasangan bisa saling merujuk,
//    tidak bisa diurutkan) → fase 1 INSERT dengan NULL, fase 2 UPDATE berpasangan.
//  * DELETE anak-dulu → induk agar FK ON DELETE (Cascade/SetNull) tidak menyisakan
//    baris yatim; seluruh INSERT induk-dulu → anak.

import { createClient } from '@libsql/client'

const LOCAL_URL = process.env.LOCAL_DB_URL ?? 'file:/home/z/my-project/db/custom.db'
const REMOTE_URL = process.env.TURSO_DATABASE_URL
const REMOTE_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!REMOTE_URL) {
  console.error(
    'TURSO_DATABASE_URL belum diset. Contoh:\n' +
      '  TURSO_DATABASE_URL="libsql://nama-db-user.aws.turso.io" \\\n' +
      '  TURSO_AUTH_TOKEN="eyJ…" bun run turso:migrate-data'
  )
  process.exit(1)
}

const local = createClient({ url: LOCAL_URL })
const remote = createClient({ url: REMOTE_URL, authToken: REMOTE_TOKEN })

// Urutan INSERT: induk dulu → anak (FK terpenuhi saat baris anak masuk).
const INSERT_ORDER = [
  'AppSettings',
  'HabitGroup',
  'Habit',
  'HabitLog',
  'DailyLog',
  'HabitOption',
  'FundSource',
  'FinanceCategory',
  'Transaction', // transferPairId ditunda ke fase 2 (self-FK melingkar)
  'WeeklyBudget',
  'BudgetSnapshot',
  'SavingsGoal',
  'RecurringTransaction',
  'TransactionRule',
  'Goal',
] as const

// Urutan DELETE kebalikannya: anak dulu → induk.
const DELETE_ORDER = [...INSERT_ORDER].reverse()

// ---------- 0. Sanity: schema remote harus sudah ada ----------
console.log('[0/4] Cek schema remote…')
const remoteTables = new Set(
  (
    await remote.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'`
    )
  ).rows.map((r) => String(r.name))
)
const missing = INSERT_ORDER.filter((t) => !remoteTables.has(t))
if (missing.length > 0) {
  console.error(
    `Tabel belum ada di remote: ${missing.join(', ')}.\n` +
      'Jalankan dulu: TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… bun run turso:push'
  )
  process.exit(1)
}
console.log('  ✓ Semua tabel tersedia.')

// ---------- helper ----------
function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'"
  return 'NULL' // fallback aman (tidak dipakai schema ini)
}

const q = (t: string) => `"${t}"`

// ---------- 1. DELETE remote (mirror semantics) ----------
console.log('[1/4] Membersihkan tabel remote…')
await remote.executeMultiple(DELETE_ORDER.map((t) => `DELETE FROM ${q(t)};`).join('\n'))
console.log('  ✓ Bersih.')

// ---------- 2. INSERT baris per tabel (induk → anak) ----------
let totalRows = 0
const transferPairs: { id: string; pair: string }[] = []

for (const table of INSERT_ORDER) {
  const rs = await local.execute(`SELECT * FROM ${q(table)}`)
  const cols = rs.columns as readonly string[]
  const rows = rs.rows as Record<string, unknown>[]
  totalRows += rows.length

  if (rows.length === 0) {
    console.log(`  · ${table.padEnd(22)} 0 baris (dilewati)`)
    continue
  }

  // Transfer: kolom self-FK di-null-kan dulu (fase 3 memulihkan).
  const isTxPairPhase = table === 'Transaction'
  const pairCol = 'transferPairId'

  // Chunk 50 baris per statement agar ukuran body aman.
  const CHUNK = 50
  const stmts: string[] = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = chunk
      .map((row) => {
        const vals = cols.map((c) => {
          if (isTxPairPhase && c === pairCol) {
            if (row[c] !== null && row[c] !== undefined) {
              transferPairs.push({ id: String(row['id']), pair: String(row[c]) })
            }
            return 'NULL'
          }
          return lit(row[c])
        })
        return `(${vals.join(', ')})`
      })
      .join(', ')
    const colList = cols.map((c) => q(c)).join(', ')
    stmts.push(`INSERT INTO ${q(table)} (${colList}) VALUES ${values};`)
  }
  await remote.executeMultiple(stmts.join('\n'))
  console.log(`  ✓ ${table.padEnd(22)} ${String(rows.length).padStart(4)} baris`)
}

// ---------- 3. Pulihkan pasangan transfer ----------
console.log('[3/4] Memulihkan pasangan transfer…')
if (transferPairs.length > 0) {
  const upd = transferPairs
    .map((p) => `UPDATE ${q('Transaction')} SET ${q('transferPairId')} = ${lit(p.pair)} WHERE ${q('id')} = ${lit(p.id)};`)
    .join('\n')
  await remote.executeMultiple(upd)
  console.log(`  ✓ ${transferPairs.length} referensi pasangan dipulihkan.`)
} else {
  console.log('  · Tidak ada pasangan transfer.')
}

// ---------- 4. Verifikasi jumlah baris ----------
console.log('[4/4] Verifikasi…')
let mismatch = 0
console.log('  Tabel                    lokal → remote')
for (const table of INSERT_ORDER) {
  const a = Number((await local.execute(`SELECT COUNT(*) c FROM ${q(table)}`)).rows[0]['c'])
  const b = Number((await remote.execute(`SELECT COUNT(*) c FROM ${q(table)}`)).rows[0]['c'])
  const ok = a === b ? '✓' : '✗ MISMATCH'
  if (a !== b) mismatch++
  console.log(`  ${table.padEnd(22)} ${String(a).padStart(5)} → ${String(b).padStart(5)}  ${ok}`)
}

if (mismatch > 0) {
  console.error(`\n✗ Gagal: ${mismatch} tabel tidak sinkron. Jangan lanjut — cek error di atas.`)
  process.exit(1)
}
console.log(`\n✓ Migrasi selesai — ${totalRows} baris tersalin, semua tabel sinkron.`)
process.exit(0)
