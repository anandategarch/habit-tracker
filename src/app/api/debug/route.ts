import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = process.env.DATABASE_URL || 'NOT SET';
    const hasToken = process.env.DATABASE_AUTH_TOKEN ? 'SET' : 'NOT SET';

    // Mask the URL for security
    const maskedUrl = url.includes('@')
      ? url.replace(/\/\/[^@]+@/, '//***@')
      : url.replace(/(libsql:\/\/[^.]+\.[^.]+\.)/, '$1***.');

    // Test actual database connection with raw libsql client
    let dbTest = 'not attempted';
    let dbError = null;

    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({
        url: process.env.DATABASE_URL || '',
        authToken: process.env.DATABASE_AUTH_TOKEN || '',
      });
      const result = await client.execute('SELECT 1 as test');
      dbTest = `OK - ${JSON.stringify(result.rows)}`;
    } catch (e: unknown) {
      dbError = e instanceof Error ? e.message : String(e);
    }

    // Test Prisma connection
    let prismaTest = 'not attempted';
    let prismaError = null;

    try {
      const { db } = await import('@/lib/db');
      const count = await db.habit.count();
      prismaTest = `OK - habit count: ${count}`;
    } catch (e: unknown) {
      prismaError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    }

    return NextResponse.json({
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: maskedUrl,
        DATABASE_AUTH_TOKEN: hasToken,
        VERCEL: process.env.VERCEL || 'not set',
      },
      libsqlTest: { result: dbTest, error: dbError },
      prismaTest: { result: prismaTest, error: prismaError },
    });
  } catch (e: unknown) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}