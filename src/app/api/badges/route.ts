import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const badges = await db.badge.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(badges);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, icon, requirement } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const badge = await db.badge.create({
      data: {
        name: name.trim(),
        description: description || '',
        icon: icon || '🏅',
        requirement: requirement || '',
      },
    });
    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create badge' }, { status: 500 });
  }
}