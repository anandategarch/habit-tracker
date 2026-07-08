import { PrismaClient } from '@prisma/client'

type PrismaClientInstance = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined
}

let _client: PrismaClientInstance | null = null;

async function createPrismaClient(): Promise<PrismaClientInstance> {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';

  if (databaseUrl.startsWith('libsql://')) {
    // Use dynamic import() for ESM compatibility on Vercel serverless
    const [{ PrismaLibSQL }, { createClient }] = await Promise.all([
      import('@prisma/adapter-libsql'),
      import('@libsql/client'),
    ]);

    const libsql = createClient({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN || '',
    });

    return new PrismaClient({ adapter: new PrismaLibSQL(libsql) } as never);
  }

  return new PrismaClient();
}

async function getClient(): Promise<PrismaClientInstance> {
  if (_client) return _client;
  if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = await createPrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  _client = client;
  return client;
}

// Proxy that lazily creates the Prisma client on first access
// All model methods become async-compatible (API routes are already async)
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop) {
    // Handle special Prisma methods ($transaction, $connect, etc.)
    if (typeof prop === 'string' && prop.startsWith('$')) {
      return (...args: unknown[]) => getClient().then((client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (client as any)[prop];
        return typeof fn === 'function' ? fn.apply(client, args) : fn;
      });
    }

    // Handle model access (e.g., db.habit.findMany())
    // Return a proxy for the model that queues operations
    return new Proxy({} as never, {
      get(_modelTarget, modelProp) {
        return (...args: unknown[]) => getClient().then((client) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const model = (client as any)[prop];
          if (!model) {
            throw new Error(`Prisma model "${String(prop)}" not found`);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = (model as any)[String(modelProp)];
          if (typeof fn === 'function') {
            return fn.apply(model, args);
          }
          return fn;
        });
      },
    });
  },
});