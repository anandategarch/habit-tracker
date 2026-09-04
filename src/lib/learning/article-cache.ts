// Extracted from src/app/api/learning/article/route.ts — in-memory article cache.
//
// BUGHUNT-OTHER-1 BUG-L17: this module-level cache is per-instance on
// Vercel serverless — each cold-start lambda has its own Map, and warm
// instances may serve only a fraction of requests. The cache therefore
// provides only partial benefit (some hits within a warm instance, no
// cross-instance sharing). A real fix would require an external cache
// (Redis, Vercel KV, etc.) which is out of scope here. Leaving the
// in-memory cache in place because it's a net positive on warm instances
// and the purge-on-day-rollover logic still prevents unbounded growth.

import { jakartaDateString } from '@/lib/timezone';

export interface ArticleData {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
  date: string;
}

export const articleCache = new Map<string, ArticleData>();

// Track article titles we've already shown today (per topic)
export const shownTodayTitles = new Map<string, Set<string>>();

// Global refresh counter per topic for unique cache keys
export const refreshCounter = new Map<string, number>();

export function getTodayKey(): string {
  return jakartaDateString();
}

export function addShownTitle(topic: string, title: string) {
  const todayKey = getTodayKey();
  const mapKey = `${todayKey}|${topic}`;
  const set = shownTodayTitles.get(mapKey) || new Set<string>();
  set.add(title);
  shownTodayTitles.set(mapKey, set);
}

export function getShownTitles(topic: string): Set<string> {
  const todayKey = getTodayKey();
  const mapKey = `${todayKey}|${topic}`;
  return shownTodayTitles.get(mapKey) || new Set<string>();
}

export function getNextRefreshId(topic: string): number {
  const current = refreshCounter.get(topic) || 0;
  const next = current + 1;
  refreshCounter.set(topic, next);
  return next;
}

// ── Cache cleanup: purge entries from previous days to prevent memory leak ──
// Module-level Maps persist across requests in serverless instances.
// Without cleanup, shownTodayTitles & articleCache grow unbounded over time.
export function purgeStaleCacheEntries() {
  const today = getTodayKey();

  // Purge shownTodayTitles: keep only today's entries
  for (const key of shownTodayTitles.keys()) {
    const date = key.split('|')[0];
    if (date !== today) {
      shownTodayTitles.delete(key);
    }
  }

  // Purge articleCache: keep only today's entries (key format: "date|topic|refreshId")
  for (const key of articleCache.keys()) {
    const date = key.split('|')[0];
    if (date !== today) {
      articleCache.delete(key);
    }
  }
}
