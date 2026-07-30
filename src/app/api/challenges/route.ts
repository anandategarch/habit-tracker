import { db } from '@/lib/db';
import { createChallengeSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const challenges = await db.challenge.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(challenges);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createChallengeSchema, body);
    if (!parsed.success) return parsed.response;
    const { title, description, duration, startDate, endDate } = parsed.data;

    const challenge = await db.challenge.create({
      data: {
        title: title.trim(),
        description: description || null,
        duration: duration || 30,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}