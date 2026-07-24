import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { updateSettingsSchema, parseOr400 } from '@/lib/validation';

export async function GET() {
  try {
    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: {} });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = parseOr400(updateSettingsSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
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