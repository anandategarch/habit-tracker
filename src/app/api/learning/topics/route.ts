import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_TOPICS = [
  { name: 'Akuntansi', emoji: '📒', order: 0 },
  { name: 'Keuangan', emoji: '💰', order: 1 },
  { name: 'Ekonomi', emoji: '📈', order: 2 },
  { name: 'Pajak', emoji: '🧾', order: 3 },
  { name: 'Investasi', emoji: '🏦', order: 4 },
  { name: 'Manajemen', emoji: '📊', order: 5 },
];

// Ensure the LearningTopic table exists (for fresh deployments / migrations)
async function ensureTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LearningTopic" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "emoji" TEXT NOT NULL DEFAULT '📚',
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "LearningTopic_name_key" ON "LearningTopic"("name");
    `);
  } catch (e) {
    console.error('Failed to ensure LearningTopic table:', e);
  }
}

// GET /api/learning/topics
export async function GET() {
  try {
    // Ensure table exists first
    await ensureTable();

    let topics = await db.learningTopic.findMany({
      orderBy: { order: 'asc' },
    });

    // Auto-seed if empty
    if (topics.length === 0) {
      try {
        await db.learningTopic.createMany({ data: DEFAULT_TOPICS });
        topics = await db.learningTopic.findMany({ orderBy: { order: 'asc' } });
      } catch (seedErr) {
        console.error('Auto-seed learning topics failed:', seedErr);
      }
    }

    return NextResponse.json(topics);
  } catch (error) {
    console.error('GET /api/learning/topics error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/learning/topics
export async function POST(request: NextRequest) {
  try {
    await ensureTable();

    const body = await request.json();
    const { name, emoji } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }

    const topic = await db.learningTopic.create({
      data: {
        name: name.trim(),
        emoji: emoji || '📚',
        order: 0,
      },
    });

    // Reorder
    const allTopics = await db.learningTopic.findMany({ orderBy: { order: 'asc' } });
    for (let i = 0; i < allTopics.length; i++) {
      await db.learningTopic.update({ where: { id: allTopics[i].id }, data: { order: i } });
    }

    return NextResponse.json(topic);
  } catch (error: unknown) {
    console.error('POST /api/learning/topics error:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Topic already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}