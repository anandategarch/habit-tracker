import { db } from '@/lib/db';
import { updateBadgeSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/badges/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const badge = await db.badge.findUnique({ where: { id } });
    if (!badge) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }
    return NextResponse.json(badge);
  } catch (error) {
    console.error('GET /api/badges/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch badge' }, { status: 500 });
  }
}

// PUT /api/badges/[id]
// Body: partial Badge fields. If `unlocked` flips to true, sets `unlockedAt`
// to now; if flips to false, clears `unlockedAt`.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = parseOr400(updateBadgeSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const update = parsed.data;

    const existing = await db.badge.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }

    // Compute unlockedAt based on the unlocked transition (if provided).
    const data: Record<string, unknown> = { ...update };
    if (update.unlocked !== undefined) {
      data.unlockedAt = update.unlocked ? new Date() : null;
    }

    const badge = await db.badge.update({ where: { id }, data });
    return NextResponse.json(badge);
  } catch (error) {
    console.error('PUT /api/badges/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update badge' }, { status: 500 });
  }
}

// DELETE /api/badges/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // `delete` throws P2025 if the row doesn't exist — normalize to 500 with
    // a clear message; the client treats non-2xx as failure.
    await db.badge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/badges/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete badge' }, { status: 500 });
  }
}
