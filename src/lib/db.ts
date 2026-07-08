import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/* eslint-disable @typescript-eslint/no-require-imports */
function createTursoClient() {
  const { PrismaLibSQL } = require('@prisma/adapter-libsql')
  const { createClient } = require('@libsql/client')

  const libsql = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN || '',
  })

  return new PrismaClient({ adapter: new PrismaLibSQL(libsql) } as never)
}
/* eslint-enable @typescript-eslint/no-require-imports */

const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db'

export const db =
  globalForPrisma.prisma ??
  (databaseUrl.startsWith('libsql://') ? createTursoClient() : new PrismaClient())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db