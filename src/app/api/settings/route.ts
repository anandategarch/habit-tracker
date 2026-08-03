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

// Shape of the validated settings body (after zod parse). The
// projectionCategoryIds field arrives as an array of strings from the
// client, but is stored as a JSON string column in SQLite.
type SettingsBody = {
  userName?: string;
  theme?: string;
  primaryColor?: string;
  secondaryColor?: string;
  weekStart?: string;
  language?: string;
  targetCompletion?: number;
  dailyBudgetTarget?: number;
  projectionCategoryIds?: string[];
};

// Build the partial data object for Prisma from validated input.
// projectionCategoryIds is serialized to a JSON string so it can be stored
// in the String column. We sort + dedupe the array for consistency so that
// two PUTs with the same categories in different order don't cause spurious
// invalidations / differ on the client.
function buildData(body: SettingsBody) {
  const data: Record<string, unknown> = {};
  if (body.userName !== undefined) data.userName = body.userName;
  if (body.theme !== undefined) data.theme = body.theme;
  if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) data.secondaryColor = body.secondaryColor;
  if (body.weekStart !== undefined) data.weekStart = body.weekStart;
  if (body.language !== undefined) data.language = body.language;
  if (body.targetCompletion !== undefined) data.targetCompletion = body.targetCompletion;
  if (body.dailyBudgetTarget !== undefined) data.dailyBudgetTarget = body.dailyBudgetTarget;
  if (body.projectionCategoryIds !== undefined) {
    const deduped = Array.from(new Set(body.projectionCategoryIds)).sort();
    data.projectionCategoryIds = JSON.stringify(deduped);
  }
  return data;
}

/**
 * Safely parse the projectionCategoryIds JSON string from the DB into an
 * array of category names. Returns [] on any parse failure or invalid
 * shape — this is the "use all categories" default, so a corrupt value
 * degrades gracefully to the pre-feature behaviour rather than crashing
 * the settings GET.
 */
function parseProjectionCategoryIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  } catch {
    return [];
  }
}

/**
 * Normalize the raw AppSettings row for the API response:
 *   - projectionCategoryIds: String("[]") → string[] (parsed)
 * This lets the client consume the value directly without JSON.parse on
 * every render. All other fields pass through unchanged.
 */
function normalizeSettings(row: Record<string, unknown>) {
  const { projectionCategoryIds, ...rest } = row as { projectionCategoryIds?: string } & Record<string, unknown>;
  return {
    ...rest,
    projectionCategoryIds: parseProjectionCategoryIds(projectionCategoryIds),
  };
}

export async function GET() {
  try {
    let settings = await db.appSettings.findFirst();
    if (!settings) {
      settings = await db.appSettings.create({ data: { id: SINGLETON_ID } });
    }
    // Normalize: projectionCategoryIds is stored as a JSON string in the DB
    // but exposed as a parsed string[] in the API response so the client can
    // consume it directly.
    return NextResponse.json(normalizeSettings(settings as unknown as Record<string, unknown>));
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
    // Edge case: if projectionCategoryIds is provided but empty, treat it
    // as "reset to all categories" (store "[]"). This is the intended UX —
    // deselecting every chip snaps back to the default (all categories)
    // rather than producing a 0-spending projection.
    // buildData already handles this correctly (empty array → "[]"), so no
    // extra branching is needed here.

    const existing = await db.appSettings.findFirst();
    if (existing) {
      const updated = await db.appSettings.update({
        where: { id: existing.id },
        data,
      });
      return NextResponse.json(normalizeSettings(updated as unknown as Record<string, unknown>));
    }

    // No existing row — create with singleton id.
    try {
      const created = await db.appSettings.create({
        data: { id: SINGLETON_ID, ...data },
      });
      return NextResponse.json(normalizeSettings(created as unknown as Record<string, unknown>));
    } catch {
      // Race: another request created the singleton between our findFirst
      // and create. Retry as update.
      const retry = await db.appSettings.findFirst();
      if (retry) {
        const updated = await db.appSettings.update({
          where: { id: retry.id },
          data,
        });
        return NextResponse.json(normalizeSettings(updated as unknown as Record<string, unknown>));
      }
      throw new Error('Failed to create or update settings after retry');
    }
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
