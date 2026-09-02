import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const subscribeSchema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }), userAgent: z.string().optional() });
function checkOrigin(request: NextRequest): boolean { const o = request.headers.get('origin'); const h = request.headers.get('host'); return !o || !h || o.includes(h); }
export async function POST(request: NextRequest) {
  try { if (!checkOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json(); const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
    const { endpoint, keys, userAgent } = parsed.data;
    const sub = await db.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null }, update: { p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null, lastUsedAt: new Date() } });
    return NextResponse.json({ success: true, id: sub.id });
  } catch (e) { return NextResponse.json({ error: 'Failed: ' + (e instanceof Error ? e.message : '') }, { status: 500 }); }
}
export async function DELETE(request: NextRequest) {
  try { if (!checkOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const ep = new URL(request.url).searchParams.get('endpoint'); if (!ep) return NextResponse.json({ error: 'Required' }, { status: 400 });
    await db.pushSubscription.deleteMany({ where: { endpoint: ep } }); return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
export async function GET() { return NextResponse.json({ enabled: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY }); }
