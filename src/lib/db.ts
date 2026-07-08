import { PrismaClient } from '@prisma/client'

type PrismaClientInstance = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined
}

function createPrismaClient(): PrismaClientInstance {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';

  if (databaseUrl.startsWith('libsql://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client');

    const libsql = createClient({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN || '',
    });

    return new PrismaClient({ adapter: new PrismaLibSQL(libsql) } as never);
  }

  return new PrismaClient();
}

function getPrismaClient(): PrismaClientInstance {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();

  // Cache in development to survive hot reloads
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

// Lazy singleton — only creates the client on first access
// This prevents build-time database connection errors on Vercel
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});