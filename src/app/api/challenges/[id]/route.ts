import { db } from '@/lib/db';
import { updateChallengeSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateChallengeSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;
    const challenge = await db.challenge.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.duration !== undefined && { duration: d.duration }),
        ...(d.progress !== undefined && { progress: d.progress }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.endDate !== undefined && { endDate: d.endDate ? new Date(d.endDate) : null }),
      },
    });
    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.challenge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete challenge' }, { status: 500 });
  }
}