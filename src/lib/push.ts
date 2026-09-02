import webpush from 'web-push';
import { db } from '@/lib/db';
let configured = false;
function ensureConfigured() { if (configured) return; const pk = process.env.VAPID_PUBLIC_KEY; const pr = process.env.VAPID_PRIVATE_KEY; if (!pk || !pr) throw new Error('VAPID not configured'); webpush.setVapidDetails(process.env.VAPID_CONTACT_EMAIL || 'mailto:dev@example.com', pk, pr); configured = true; }
export interface PushMessage { title: string; body: string; tag?: string; url?: string; icon?: string; requireInteraction?: boolean; actions?: Array<{ action: string; title: string; icon?: string }>; }
export async function sendPushToAll(message: PushMessage): Promise<{ sent: number; failed: number }> {
  ensureConfigured(); const subs = await db.pushSubscription.findMany(); if (!subs.length) return { sent: 0, failed: 0 };
  const payload = JSON.stringify({ title: message.title, body: message.body, tag: message.tag || 'r', data: { url: message.url || '/' }, icon: message.icon || '/icon-192.png', badge: '/icon-96.png', requireInteraction: message.requireInteraction || false, actions: message.actions || [], vibrate: [100, 50, 100] });
  let sent = 0, failed = 0; const stale: string[] = []; const ok: string[] = [];
  const results = await Promise.allSettled(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)));
  for (let i = 0; i < results.length; i++) { if (results[i].status === 'fulfilled') { sent++; ok.push(subs[i].endpoint); } else { failed++; const sc = (results[i] as PromiseRejectedResult).reason?.statusCode; if (sc === 410 || sc === 404) stale.push(subs[i].endpoint); } }
  if (stale.length) await db.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  if (ok.length) await db.pushSubscription.updateMany({ where: { endpoint: { in: ok } }, data: { lastUsedAt: new Date() } });
  return { sent, failed };
}
