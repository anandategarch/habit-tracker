import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createRewardSchema, parseOr400 } from '@/lib/validation';

export async function GET() {
  try {
    const rewards = await db.reward.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rewards);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = parseOr400(createRewardSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { name, description, unlockCondition, xpCost } = parsed.data;

    const reward = await db.reward.create({
      data: {
        name: name.trim(),
        description: description || null,
        unlockCondition: unlockCondition || '',
        xpCost: xpCost || 0,
      },
    });
    return NextResponse.json(reward, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}