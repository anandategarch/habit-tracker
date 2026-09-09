import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Satu jalur database untuk semua lingkungan (adapter libsql + Prisma driverAdapters):
//  * Lokal / sandbox : DATABASE_URL=file:/abs/path/custom.db  (SQLite via libsql)
//  * Vercel / prod   : DATABASE_URL=libsql://… + DATABASE_AUTH_TOKEN (Turso)
// Schema push ke Turso: `bun run turso:push` (prisma migrate diff → executeMultiple).
// Catatan: PrismaLibSQL menerima CONFIG {url, authToken} — bukan instance createClient.

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL belum diset — set file:… (lokal) atau libsql://… + DATABASE_AUTH_TOKEN (Turso/Vercel).'
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN, // hanya relevan untuk libsql:// (Turso)
    }),
    // Log query hanya di development agar log Vercel tidak banjir.
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
