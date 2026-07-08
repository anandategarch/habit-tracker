import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// One-time migration endpoint to add the 'source' column to Transaction table
export async function GET() {
  try {
    // Check if source column already exists
    const columns = await db.$queryRaw<Array<{ name: string }>>(
      `PRAGMA table_info("Transaction")`
    );

    const hasSource = columns.some(c => c.name === 'source');

    if (!hasSource) {
      await db.$executeRaw(`ALTER TABLE "Transaction" ADD COLUMN source TEXT DEFAULT 'Kas'`);
      return NextResponse.json({ success: true, message: 'Column "source" added to Transaction table' });
    }

    return NextResponse.json({ success: true, message: 'Column "source" already exists, no action needed' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}