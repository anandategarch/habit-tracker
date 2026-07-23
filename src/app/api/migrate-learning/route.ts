import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// One-time migration: seed default learning topics
// Call GET /api/migrate-learning to run
export async function GET() {
  try {
    const count = await db.learningTopic.count();
    if (count === 0) {
      await db.learningTopic.createMany({
        data: [
          { name: 'Akuntansi', emoji: '📒', order: 0 },
          { name: 'Keuangan', emoji: '💰', order: 1 },
          { name: 'Ekonomi', emoji: '📈', order: 2 },
          { name: 'Pajak', emoji: '🧾', order: 3 },
          { name: 'Investasi', emoji: '🏦', order: 4 },
          { name: 'Manajemen', emoji: '📊', order: 5 },
        ],
      });
      const topics = await db.learningTopic.findMany({ orderBy: { order: 'asc' } });
      return NextResponse.json({ success: true, message: '6 default topics seeded', topics });
    }
    const topics = await db.learningTopic.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json({ success: true, message: `${count} topics already exist`, topics });
  } catch (e: unknown) {
    console.error('migrate-learning error:', e);
    return NextResponse.json({ success: false, error: 'Failed to seed learning topics' }, { status: 500 });
  }
}