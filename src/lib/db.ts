import { PrismaClient } from '@prisma/client'

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

type PrismaClientInstance = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined
}

// Lazy: only create PrismaClient when first accessed (not at module load time)
// This prevents build-time database connection errors on Vercel
function getOrCreateClient(): PrismaClientInstance {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db'
  const client = databaseUrl.startsWith('libsql://')
    ? createTursoClient()
    : new PrismaClient()

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }

  return client
}

// Use a proxy to defer client creation until first actual query
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getOrCreateClient()
    const value = Reflect.get(client, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})