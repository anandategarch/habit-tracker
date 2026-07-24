import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createBadgeSchema, parseOr400 } from '@/lib/validation';

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
    const parsed = parseOr400(createBadgeSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { name, description, icon, requirement } = parsed.data;

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