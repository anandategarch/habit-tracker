import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Extracted modules — see src/lib/learning/*
import {
  type ArticleData,
  articleCache,
  addShownTitle,
  getShownTitles,
  getTodayKey,
  purgeStaleCacheEntries,
} from '@/lib/learning/article-cache';
import { getSearchQueries } from '@/lib/learning/topic-queries';
import { FALLBACK_ARTICLES, DEFAULT_FALLBACK } from '@/lib/learning/fallback-articles';
import { summarizeArticle } from '@/lib/learning/summarize';

// ── Main GET handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Purge stale cache entries from previous days to prevent memory leak
    purgeStaleCacheEntries();

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || '';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const todayKey = getTodayKey();

    if (!topic) {
      return NextResponse.json({ ...DEFAULT_FALLBACK, topic: '', source: 'fallback', date: todayKey });
    }

    const cacheKey = `${todayKey}|${topic}`;

    // Return cache only if NOT forced refresh AND no refresh param
    if (!forceRefresh) {
      const cached = articleCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const shown = getShownTitles(topic);
    let article = { title: '', content: '', funFact: '' };
    let source = 'fallback';

    // Try to fetch from internet
    const zai = await ZAI.create();
    const queries = getSearchQueries(topic);

    try {
      // Shuffle queries and try UP TO 5 DIFFERENT queries to find new content
      const shuffled = [...queries].sort(() => Math.random() - 0.5);
      const maxQueryAttempts = Math.min(5, shuffled.length);

      for (let qi = 0; qi < maxQueryAttempts; qi++) {
        if (article.title && article.content) break;

        const query = shuffled[qi];

        const searchResults = await zai.functions.invoke('web_search', {
          query,
          num: 10,
        });

        if (Array.isArray(searchResults) && searchResults.length > 0) {
          // Filter: exclude PDFs/downloads, must have URL and decent snippet
          let goodResults = (searchResults as Array<{ url?: string; name?: string; snippet?: string }>)
            .filter(r => r.url && !r.url.toLowerCase().endsWith('.pdf') && !r.url.includes('/download/'))
            .filter(r => r.snippet && r.snippet.length > 50);

          // Soft filter: prefer unseen, but allow seen if nothing new
          const unseen = goodResults.filter(r => !shown.has(r.name || ''));
          const resultsToTry = unseen.length > 0 ? unseen : goodResults;

          if (resultsToTry.length > 0) {
            // Try up to 3 different pages per query
            const tryResults = resultsToTry.slice(0, Math.min(3, resultsToTry.length));

            for (const selected of tryResults) {
              try {
                const pageResult = await zai.functions.invoke('page_reader', {
                  url: selected.url!,
                });

                const pageData = (pageResult as { data?: { title?: string; html?: string } })?.data;
                const pageTitle = pageData?.title || selected.name || topic;
                const rawHtml = pageData?.html || '';
                const plainText = rawHtml
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/\s+/g, ' ')
                  .trim();

                if (plainText.length > 200) {
                  const result = await summarizeArticle(zai, pageTitle, plainText, topic);
                  if (result.title && result.content && result.content.length > 1000) {
                    article = result;
                    break; // Success — stop trying other pages
                  }
                }
              } catch {
                continue;
              }
            }
          }
        }
      }

      // If all web fetches failed, try LLM with diverse snippets
      if (!article.title || !article.content) {
        // Gather snippets from ALL queries
        const allSnippets: string[] = [];
        for (let qi = 0; qi < Math.min(3, shuffled.length); qi++) {
          try {
            const searchResults = await zai.functions.invoke('web_search', {
              query: shuffled[qi],
              num: 5,
            });
            if (Array.isArray(searchResults)) {
              for (const r of searchResults.slice(0, 3)) {
                const result = r as { name?: string; snippet?: string };
                if (result.snippet && result.snippet.length > 50) {
                  allSnippets.push(`${result.name}: ${result.snippet}`);
                }
              }
            }
          } catch {
            continue;
          }
        }

        const combinedSnippets = allSnippets.join('\n\n');
        if (combinedSnippets.length > 200) {
          article = await summarizeArticle(zai, `Berbagai topik ${topic}`, combinedSnippets, topic);
        }
      }
    } catch (e) {
      console.error('Web fetch failed:', e);
    }

    // Use fallback if web fetch didn't produce a good article
    if (!article.title || !article.content || article.content.length < 500) {
      const fallbacks = FALLBACK_ARTICLES[topic] || [];
      if (fallbacks.length > 0) {
        // Pick a fallback NOT in shown set
        const unseen = fallbacks.filter(f => !shown.has(f.title));
        if (unseen.length > 0) {
          article = unseen[Math.floor(Math.random() * unseen.length)];
        } else {
          // All seen, pick random anyway (better than nothing)
          article = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
      } else {
        article = DEFAULT_FALLBACK;
      }
      source = 'fallback';
    } else {
      source = 'web';
    }

    // Track this title as shown
    addShownTitle(topic, article.title);

    const result: ArticleData = {
      title: article.title,
      content: article.content,
      funFact: article.funFact,
      topic,
      source,
      date: todayKey,
    };

    // Update cache: first load of the day gets cached; refreshes do NOT overwrite
    if (!forceRefresh) {
      articleCache.set(cacheKey, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/learning/article error:', error);

    const topic = new URL(request.url).searchParams.get('topic') || '';
    const fallbacks = FALLBACK_ARTICLES[topic] || [];
    const fb = fallbacks.length > 0
      ? fallbacks[Math.floor(Math.random() * fallbacks.length)]
      : DEFAULT_FALLBACK;

    return NextResponse.json({
      ...fb,
      topic,
      source: 'fallback',
      date: getTodayKey(),
    });
  }
}

// POST is unused (streak is handled by GET on /api/learning/complete)
export async function POST() {
  return NextResponse.json({ error: 'Use GET' }, { status: 405 });
}
