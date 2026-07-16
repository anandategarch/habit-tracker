import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const txCount = await db.transaction.count();
    const srcCount = await db.fundSource.count();
    const sampleSrc = await db.fundSource.findFirst();
    return NextResponse.json({ 
      txCount, 
      srcCount, 
      sampleSrc: sampleSrc ? { name: sampleSrc.name, balance: sampleSrc.balance } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to query database' }, { status: 500 });
  }
}
