import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '(not set)';
  const hasToken = process.env.DATABASE_AUTH_TOKEN ? 'yes' : 'no';
  const isTurso = dbUrl.startsWith('libsql://');
  const hasAuthTokenInUrl = dbUrl.includes('?authToken=');

  // Parse like db.ts does
  let cleanUrl = dbUrl;
  let authToken = process.env.DATABASE_AUTH_TOKEN || '';
  if (dbUrl.includes('?authToken=')) {
    const parts = dbUrl.split('?authToken=');
    cleanUrl = parts[0];
    authToken = parts[1] || authToken;
  }

  // Debug info (masked)
  const debug = {
    rawUrlLength: dbUrl.length,
    rawUrlStarts: dbUrl.substring(0, 60),
    rawUrlEnds: dbUrl.substring(dbUrl.length - 20),
    cleanUrl: cleanUrl.substring(0, 60),
    cleanUrlLength: cleanUrl.length,
    authTokenLength: authToken.length,
    authTokenStarts: authToken ? authToken.substring(0, 20) + '...' : '(empty)',
    hasWhitespace: dbUrl !== dbUrl.trim(),
    hasNewline: dbUrl.includes('\n') || dbUrl.includes('\r'),
    hasQuotes: dbUrl.startsWith('"') || dbUrl.startsWith("'"),
  };

  // Test DB connection with detailed error
  let dbStatus = 'unknown';
  let dbCount = -1;
  let dbError = '';
  try {
    const { db } = await import('@/lib/db');
    dbCount = await db.transaction.count();
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error';
    dbError = e instanceof Error ? e.message.substring(0, 500) : String(e).substring(0, 500);
  }

  return NextResponse.json({
    isTurso,
    hasAuthTokenInUrl,
    hasSeparateAuthToken: hasToken,
    debug,
    dbStatus,
    dbCount,
    dbError,
    timestamp: new Date().toISOString(),
  });
}
