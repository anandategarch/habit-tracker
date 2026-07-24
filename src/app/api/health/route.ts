import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '(not set)';
  const hasToken = process.env.DATABASE_AUTH_TOKEN ? 'yes' : 'no';
  const isTurso = dbUrl.startsWith('libsql://');
  const hasAuthTokenInUrl = dbUrl.includes('?authToken=');

  // Mask sensitive parts
  let maskedUrl = dbUrl;
  if (maskedUrl.includes('?authToken=')) {
    maskedUrl = maskedUrl.split('?authToken=')[0] + '?authToken=***';
  }
  if (maskedUrl.length > 80) {
    maskedUrl = maskedUrl.substring(0, 80) + '...';
  }

  // Test actual DB connection
  let dbStatus = 'unknown';
  let dbCount = -1;
  try {
    const { db } = await import('@/lib/db');
    dbCount = await db.transaction.count();
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error: ' + (e instanceof Error ? e.message.substring(0, 200) : String(e));
  }

  return NextResponse.json({
    databaseUrl: maskedUrl,
    isTurso,
    hasAuthTokenInUrl,
    hasSeparateAuthToken: hasToken,
    dbStatus,
    transactionCount: dbCount,
    timestamp: new Date().toISOString(),
  });
}
