// Sinkronisasi schema Prisma → database Turso (libsql://) secara idempoten.
//
// Prisma Migrate/db push CLI tidak mendukung libsql:// secara langsung, jadi:
//   1. Dump DDL tabel+indeks dari DB remote (sqlite_master) ke file SQLite lokal sementara
//   2. `prisma migrate diff --from-url <file lokal> --to-schema-datamodel prisma/schema.prisma --script`
//      → hanya menghasilkan DELTA (aman diulang kapan pun; DB kosong → DDL penuh)
//   3. Terapkan delta ke remote via client.executeMultiple()
//
// Cara pakai:
//   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run turso:push
//   (untuk uji lokal: TURSO_DATABASE_URL="file:/home/z/my-project/db/custom.db")
//
// Catatan: menghapus model di schema.prisma akan menghasilkan DROP TABLE di remote —
// perintah ini tidak meminta konfirmasi, backup dulu bila perlu.

import { createClient } from '@libsql/client'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REMOTE_URL = process.env.TURSO_DATABASE_URL
const REMOTE_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!REMOTE_URL) {
  console.error(
    'TURSO_DATABASE_URL belum diset. Contoh:\n' +
      '  TURSO_DATABASE_URL="libsql://nama-db-user.aws.turso.io" \\\n' +
      '  TURSO_AUTH_TOKEN="eyJ…" bun run turso:push'
  )
  process.exit(1)
}

const remote = createClient({ url: REMOTE_URL, authToken: REMOTE_TOKEN })

// ---------- 1. Dump DDL remote → file sqlite lokal sementara ----------
console.log('[1/3] Membaca schema remote…')
const objects = await remote.execute(
  `SELECT name, sql FROM sqlite_master
   WHERE sql IS NOT NULL
     AND name NOT LIKE 'sqlite_%'
     AND name NOT LIKE '_prisma_%'
   ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END`
)

const tmpDir = mkdtempSync(join(tmpdir(), 'turso-push-'))
const tmpDb = join(tmpDir, 'remote.db')
const local = createClient({ url: `file:${tmpDb}` })

for (const row of objects.rows) {
  const sql = String(row.sql)
  // PRAGMA tidak boleh dijalankan dalam executeMultiple transaksional — buang.
  if (!sql.toUpperCase().startsWith('PRAGMA')) {
    await local.execute(sql)
  }
}

// ---------- 2. Hitung delta via prisma migrate diff ----------
console.log('[2/3] Menghitung delta schema…')
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const prismaBin = join(projectRoot, 'node_modules', '.bin', 'prisma')
const diff = spawnSync(prismaBin, [
  'migrate',
  'diff',
  '--from-url',
  `file:${tmpDb}`,
  '--to-schema-datamodel',
  join(projectRoot, 'prisma', 'schema.prisma'),
  '--script',
])

if (diff.error || diff.status !== 0) {
  console.error('Gagal menjalankan prisma migrate diff:', diff.error ?? diff.stderr?.toString())
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(1)
}

let delta = diff.stdout.toString().trim()

// ---------- 3. Terapkan delta ke remote ----------
if (!delta) {
  console.log('[3/3] Tidak ada perubahan — schema remote sudah sinkron. ✓')
} else {
  console.log('[3/3] Menerapkan delta ke remote…')
  // prisma kadang membungkus dengan PRAGMA — buang agar aman untuk executeMultiple.
  delta = delta
    .split('\n')
    .filter((line) => !line.trim().toUpperCase().startsWith('PRAGMA'))
    .join('\n')
    .trim()
  try {
    await remote.executeMultiple(delta)
    console.log('Berikut pernyataan yang diterapkan:\n')
    console.log(delta)
    console.log('\n✓ Schema remote tersinkron.')
  } catch (err) {
    console.error('Gagal menerapkan delta:', err instanceof Error ? err.message : err)
    console.error('\nSQL delta (untuk debug):\n', delta)
    process.exit(1)
  }
}

rmSync(tmpDir, { recursive: true, force: true })
process.exit(0)
