import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// One-time migration endpoint to add the 'source' column to Transaction table
export async function GET() {
  try {
    // 'Transaction' is a SQL reserved word, use bracket notation for SQLite
    try {
      await db.$executeRawUnsafe('ALTER TABLE [Transaction] ADD COLUMN source TEXT DEFAULT \'Kas\'');
      return NextResponse.json({ success: true, message: 'Column "source" added to Transaction table' });
    } catch (alterError: unknown) {
      const msg = alterError instanceof Error ? alterError.message : String(alterError);
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        return NextResponse.json({ success: true, message: 'Column "source" already exists, no action needed' });
      }
      throw alterError;
    }
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}