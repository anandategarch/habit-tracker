import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  // ── Production safety check ──────────────────────────────────────
  // Previously fell back silently to `file:./db/dev.db` if DATABASE_URL
  // was unset. On Vercel serverless, that path is an ephemeral read-only
  // file inside the lambda container — writes would silently fail or be
  // lost between invocations. Fail fast in production instead.
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DATABASE_URL is not set. Production deployments must configure a ' +
        'Turso/libsql database URL. See .env.example for details.'
      );
    }
    // Dev only: fall back to local SQLite for convenience.
    console.warn('⚠️  DATABASE_URL not set — using local SQLite (dev only).');
  }

  const effectiveUrl = databaseUrl || 'file:./db/dev.db';

  if (effectiveUrl.startsWith('libsql://')) {
    // Parse authToken from URL query param: libsql://host?authToken=TOKEN
    // This allows using a single DATABASE_URL env var on Vercel/Turso deployments.
    let cleanUrl = effectiveUrl;
    let authToken = process.env.DATABASE_AUTH_TOKEN || '';

    // Extract authToken from URL if present (?authToken=xxx)
    if (effectiveUrl.includes('?authToken=')) {
      const parts = effectiveUrl.split('?authToken=');
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

// Lazy singleton: only creates PrismaClient on first property access.
// The Proxy delegates all property access to the real PrismaClient.
// We cast to PrismaClient (not `any`) so TypeScript resolves model
// accessors (db.habit, db.transaction, etc.) correctly.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
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