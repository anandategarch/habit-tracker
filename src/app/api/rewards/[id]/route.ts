import { db } from '@/lib/db';
import { updateRewardSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/rewards/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reward = await db.reward.findUnique({ where: { id } });
    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }
    return NextResponse.json(reward);
  } catch (error) {
    console.error('GET /api/rewards/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch reward' }, { status: 500 });
  }
}

// PUT /api/rewards/[id]
// Body: partial Reward fields. If `status` flips to 'unlocked', sets
// `unlockedAt` to now; if flips to 'redeemed', sets `redeemedAt` to now.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = parseOr400(updateRewardSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const update = parsed.data;

    const existing = await db.reward.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = { ...update };
    if (update.status !== undefined) {
      if (update.status === 'unlocked') {
        data.unlockedAt = new Date();
      } else if (update.status === 'redeemed') {
        data.redeemedAt = new Date();
        // Also mark unlockedAt if it wasn't already set.
        if (!existing.unlockedAt) data.unlockedAt = new Date();
      } else {
        // Locked — clear both timestamps.
        data.unlockedAt = null;
        data.redeemedAt = null;
      }
    }

    const reward = await db.reward.update({ where: { id }, data });
    return NextResponse.json(reward);
  } catch (error) {
    console.error('PUT /api/rewards/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 });
  }
}

// DELETE /api/rewards/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.reward.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/rewards/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 });
  }
}
