import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { updateSettingsSchema, parseOr400 } from '@/lib/validation';

// AppSettings is a singleton — there should only ever be one row.
//
// Race-condition-safe approach:
//   1. findFirst to get the existing row (preserves legacy rows with
//      cuid-generated IDs and their user data)
//   2. If found → update by its actual id (atomic row-level lock)
//   3. If not found → create with a fixed singleton id (so future finds
//      are deterministic). If two concurrent creates race, the loser
//      catches the error and retries as update.
//
// Previously used findFirst() + create()/update() without a transaction,
// which had a race: two concurrent PUTs could both observe no row and
// both create one, leading to duplicate AppSettings rows where findFirst()
// returns an arbitrary one (and the user's saved dailyBudgetTarget could
// "vanish" if the wrong row was returned).
const SINGLETON_ID = 'singleton';

// Build the partial data object from validated input.
function buildData(body: Partial<{
  userName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  weekStart: string;
  language: string;
  targetCompletion: number;
  dailyBudgetTarget: number;
}>) {
  return {
    ...(body.userName !== undefined && { userName: body.userName }),
    ...(body.theme !== undefined && { theme: body.theme }),
    ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
    ...(body.secondaryColor !== undefined && { secondaryColor: body.secondaryColor }),
    ...(body.weekStart !== undefined && { weekStart: body.weekStart }),
    ...(body.language !== undefined && { language: body.language }),
    ...(body.targetCompletion !== undefined && { targetCompletion: body.targetCompletion }),
    ...(body.dailyBudgetTarget !== undefined && { dailyBudgetTarget: body.dailyBudgetTarget }),
  };
}

export async function GET() {
  try {
    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: { id: SINGLETON_ID } });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    // Return a proper error response (was `[]` — type mismatch with the
    // AppSettings object the client expects, silently breaking settings-
    // dependent UI like the budget ring when DB was unreachable).
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = parseOr400(updateSettingsSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const data = buildData(body);

    // Race-safe upsert: find existing → update; if not found → create with
    // singleton id. If create races (unique constraint violation on id),
    // retry as update. This preserves legacy rows (with cuid IDs + user data)
    // while preventing duplicates going forward.
    const existing = await db.appSettings.findFirst();
    if (existing) {
      const updated = await db.appSettings.update({
        where: { id: existing.id },
        data,
      });
      return NextResponse.json(updated);
    }

    // No existing row — create with singleton id.
    try {
      const created = await db.appSettings.create({
        data: { id: SINGLETON_ID, ...data },
      });
      return NextResponse.json(created);
    } catch {
      // Race: another request created the singleton between our findFirst
      // and create. Retry as update.
      const retry = await db.appSettings.findFirst();
      if (retry) {
        const updated = await db.appSettings.update({
          where: { id: retry.id },
          data,
        });
        return NextResponse.json(updated);
      }
      throw new Error('Failed to create or update settings after retry');
    }
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
