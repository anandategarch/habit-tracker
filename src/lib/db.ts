import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

type PrismaClientInstance = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined
}

function createPrismaClient(): PrismaClientInstance {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';

  if (databaseUrl.startsWith('libsql://')) {
    // Parse authToken from URL query param: libsql://host?authToken=TOKEN
    // This allows using a single DATABASE_URL env var on Vercel/Turso deployments.
    let cleanUrl = databaseUrl;
    let authToken = process.env.DATABASE_AUTH_TOKEN || '';

    // Extract authToken from URL if present (?authToken=xxx)
    if (databaseUrl.includes('?authToken=')) {
      const parts = databaseUrl.split('?authToken=');
      cleanUrl = parts[0];
      authToken = parts[1] || authToken;
    }

    // Override DATABASE_URL to a valid SQLite path before constructing PrismaClient.
    // The adapter handles the actual connection, but PrismaClient still validates
    // the datasource URL against the "sqlite" provider at construction time.
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'file:./dummy.db';

    const client = new PrismaClient({
      adapter: new PrismaLibSQL({
        url: cleanUrl,
        authToken,
      }),
    } as never);

    // Restore the real URL for any future reference
    process.env.DATABASE_URL = originalUrl;
    return client;
  }

  return new PrismaClient();
}

// Lazy singleton: only creates PrismaClient on first property access
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const client = globalForPrisma.prisma;
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});