import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: {} });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    let settings = await db.appSettings.findFirst();

    if (!settings) {
      settings = await db.appSettings.create({
        data: {
          ...(body.userName !== undefined && { userName: body.userName }),
          ...(body.theme !== undefined && { theme: body.theme }),
          ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
          ...(body.secondaryColor !== undefined && { secondaryColor: body.secondaryColor }),
          ...(body.weekStart !== undefined && { weekStart: body.weekStart }),
          ...(body.language !== undefined && { language: body.language }),
          ...(body.targetCompletion !== undefined && { targetCompletion: body.targetCompletion }),
        },
      });
    } else {
      settings = await db.appSettings.update({
        where: { id: settings.id },
        data: {
          ...(body.userName !== undefined && { userName: body.userName }),
          ...(body.theme !== undefined && { theme: body.theme }),
          ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
          ...(body.secondaryColor !== undefined && { secondaryColor: body.secondaryColor }),
          ...(body.weekStart !== undefined && { weekStart: body.weekStart }),
          ...(body.language !== undefined && { language: body.language }),
          ...(body.targetCompletion !== undefined && { targetCompletion: body.targetCompletion }),
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}