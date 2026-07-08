import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/learning/topics
export async function GET() {
  try {
    const topics = await db.learningTopic.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(topics);
  } catch (error) {
    console.error('GET /api/learning/topics error:', error);
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

// POST /api/learning/topics
export async function POST(request: NextRequest) {
  try {
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