import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rewards = await db.reward.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rewards);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, unlockCondition, xpCost } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

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