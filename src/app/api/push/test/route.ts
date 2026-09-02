import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/push';
export async function POST(request: NextRequest) {
  try { const o = request.headers.get('origin'); const h = request.headers.get('host'); if (o && h && !o.includes(h)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const r = await sendPushToAll({ title: '🧪 Test Notifikasi', body: 'Push berhasil! Kamu akan terima reminder harian di sini.', tag: 'test', url: '/?tab=settings' });
    if (r.sent === 0) return NextResponse.json({ success: false, error: 'Tidak ada subscriber.' }, { status: 400 });
    return NextResponse.json({ success: true, sent: r.sent, message: `Terkirim ke ${r.sent} device!` });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : '' }, { status: 500 }); }
}
