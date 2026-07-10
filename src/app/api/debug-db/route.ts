import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const txCount = await db.transaction.count();
    const srcCount = await db.fundSource.count();
    // Try to query a source with type field
    const sampleSrc = await db.fundSource.findFirst();
    return NextResponse.json({ 
      txCount, 
      srcCount, 
      sampleSrc: sampleSrc ? { name: sampleSrc.name, type: sampleSrc.type, initialBalance: sampleSrc.initialBalance } : null,
      dbUrl: process.env.DATABASE_URL 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack?.slice(0, 500) }, { status: 500 });
  }
}
