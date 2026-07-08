import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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
  } catch { /* ignore */ }
}

// PUT /api/learning/topics/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTable();
    const { id } = await params;
    const body = await request.json();
    const { name, emoji } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }

    const topic = await db.learningTopic.update({
      where: { id },
      data: {
        name: name.trim(),
        ...(emoji !== undefined && { emoji }),
      },
    });

    return NextResponse.json(topic);
  } catch (error: unknown) {
    console.error('PUT /api/learning/topics/[id] error:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Topic name already exists' }, { status: 409 });
    }
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

// DELETE /api/learning/topics/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTable();
    const { id } = await params;
    await db.learningTopic.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DELETE /api/learning/topics/[id] error:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}