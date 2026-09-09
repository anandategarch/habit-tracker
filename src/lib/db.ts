import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Satu jalur database untuk semua lingkungan (adapter libsql + Prisma driverAdapters):
//  * Lokal / sandbox : DATABASE_URL=file:/abs/path/custom.db  (SQLite via libsql)
//  * Vercel / prod   : DATABASE_URL=libsql://… + DATABASE_AUTH_TOKEN (Turso)
//  * Gaya lama (cb37fea) juga didukung: token tertanam di URL —
//    DATABASE_URL="libsql://…?authToken=eyJ…" (satu env var saja).
// Schema push ke Turso: `bun run turso:push` (prisma migrate diff → executeMultiple).
// Catatan: PrismaLibSQL menerima CONFIG {url, authToken} — bukan instance createClient.

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) {
  throw new Error(
    'DATABASE_URL belum diset — set file:… (lokal) atau libsql://… + DATABASE_AUTH_TOKEN (Turso/Vercel).'
  )
}

// Kompatibilitas setup lama: token tertanam di URL meng-override env var
// (perilaku identik dengan db.ts era cb37fea).
let databaseUrl = rawUrl
let authToken = process.env.DATABASE_AUTH_TOKEN
if (rawUrl.includes('?authToken=')) {
  const parts = rawUrl.split('?authToken=')
  databaseUrl = parts[0]
  authToken = parts[1] || authToken
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({
      url: databaseUrl,
      authToken, // hanya relevan untuk libsql:// (Turso)
    }),
    // Log query hanya di development agar log Vercel tidak banjir.
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
