import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory daily cache
let cachedQuote: { quote: string; translation: string; author: string; date: string } | null = null;

function getTodayKey(): string {
  const now = new Date();
  // Use Asia/Jakarta timezone
  const jakartaOffset = 7 * 60; // UTC+7
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + jakartaOffset * 60000);
  return jakarta.toISOString().split('T')[0];
}

function cleanQuote(text: string): string {
  let cleaned = text
    .replace(/^["""''«]/, '')
    .replace(/["""''»]$/, '')
    .trim();
  cleaned = cleaned.replace(/^\.{3,}\s*/, '').replace(/\s*\.{3,}$/, '');
  if (!/[.!?,;:]$/.test(cleaned)) cleaned += '.';
  return cleaned;
}

const FALLBACK_QUOTES = [
  { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', translation: 'Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu lakukan.' },
  { quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill', translation: 'Kesuksesan bukan akhir, kegagalan bukan fatal: yang penting adalah keberanian untuk terus melanjutkan.' },
  { quote: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt', translation: 'Percayalah bahwa kamu bisa, dan kamu sudah setengah jalan.' },
  { quote: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', translation: 'Masa depan milik mereka yang percaya pada keindahan mimpi mereka.' },
  { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius', translation: 'Tidak masalah seberapa lambat kamu berjalan, selama kamu tidak berhenti.' },
  { quote: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', translation: 'Disiplin adalah jembatan antara tujuan dan pencapaian.' },
  { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb', translation: 'Waktu terbaik menanam pohon adalah 20 tahun lalu. Waktu terbaik kedua adalah sekarang.' },
  { quote: 'Your limitation—it\'s only your imagination.', author: 'Anonymous', translation: 'Batasanmu—hanya imajinasimu saja.' },
  { quote: 'Great things never come from comfort zones.', author: 'Anonymous', translation: 'Hal-hal hebat tidak pernah datang dari zona nyaman.' },
  { quote: 'Dream it. Wish it. Do it.', author: 'Anonymous', translation: 'Mimpikanlah. Harapkanlah. Lakukanlah.' },
  { quote: 'The harder you work for something, the greater you\'ll feel when you achieve it.', author: 'Anonymous', translation: 'Semakin keras kamu berusaha untuk sesuatu, semakin besar perasaanmu saat mencapainya.' },
  { quote: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson', translation: 'Jangan pantau jam; lakukan apa yang dilakukannya. Teruslah berjalan.' },
];

async function translateToIndonesian(zai: Awaited<ReturnType<typeof ZAI.create>>, englishQuote: string): Promise<string> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: 'You are a translator. Translate the given English quote to natural Indonesian. Only reply with the translation, nothing else. Do not add quotes or explanation.',
        },
        {
          role: 'user',
          content: englishQuote,
        },
      ],
      thinking: { type: 'disabled' },
    });
    const translation = completion.choices[0]?.message?.content?.trim();
    if (translation && translation.length > 5) {
      // Clean up translation
      return translation.replace(/^["""''«]/, '').replace(/["""''»]$/, '').trim();
    }
  } catch {
    // LLM translation failed, use fallback
  }
  return '';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const todayKey = getTodayKey();

    // Return cached quote if still valid for today (unless force refresh)
    if (!forceRefresh && cachedQuote && cachedQuote.date === todayKey) {
      return NextResponse.json(cachedQuote);
    }

    const zai = await ZAI.create();

    // Search for English motivational quotes
    const quoteTopics = [
      'short motivational quotes in english',
      'inspirational quotes for today english',
      'best daily motivation quotes english',
      'powerful short quotes about life english',
    ];

    const randomTopic = quoteTopics[Math.floor(Math.random() * quoteTopics.length)];

    const results = await zai.functions.invoke('web_search', {
      query: randomTopic,
      num: 10,
    });

    let selectedQuote = '';
    let selectedAuthor = 'Anonymous';

    if (Array.isArray(results) && results.length > 0) {
      // Prioritize results that contain quote-like content
      const quoteResults = results.filter(
        (r: { snippet?: string; name?: string }) =>
          r.snippet &&
          r.snippet.length > 25 &&
          r.snippet.length < 300 &&
          (r.name?.toLowerCase().includes('quote') ||
            r.name?.toLowerCase().includes('motivat') ||
            r.snippet.includes('"') ||
            r.snippet.includes('"') ||
            r.snippet.includes('"'))
      );

      const source = quoteResults.length > 0
        ? quoteResults[Math.floor(Math.random() * Math.min(3, quoteResults.length))]
        : results[Math.floor(Math.random() * Math.min(5, results.length))];

      if (source?.snippet) {
        selectedQuote = cleanQuote(source.snippet);

        // Try to extract author from name or snippet
        const authorPatterns = [
          /[-–—]\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
          /by\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/i,
          /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*once said/i,
        ];
        for (const pattern of authorPatterns) {
          const match = (source.name + ' ' + source.snippet).match(pattern);
          if (match) {
            selectedAuthor = match[1].trim();
            break;
          }
        }
      }
    }

    // Truncate if too long
    if (selectedQuote.length > 200) {
      const sentenceEnd = selectedQuote.search(/[.!?]\s/);
      if (sentenceEnd > 40) {
        selectedQuote = selectedQuote.substring(0, sentenceEnd + 1);
      } else {
        selectedQuote = selectedQuote.substring(0, 200).replace(/\s+\S*$/, '') + '...';
      }
    }

    // Use fallback if extraction failed
    if (!selectedQuote || selectedQuote.length < 15) {
      const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
      cachedQuote = { quote: fallback.quote, translation: fallback.translation, author: fallback.author, date: todayKey };
      return NextResponse.json(cachedQuote);
    }

    // Check if the quote matches a known fallback (to use its translation)
    const knownQuote = FALLBACK_QUOTES.find(f => selectedQuote.toLowerCase().includes(f.quote.toLowerCase().substring(0, 20)));
    let translation = knownQuote?.translation || '';

    // Translate using LLM if no known translation
    if (!translation) {
      translation = await translateToIndonesian(zai, selectedQuote);
    }

    cachedQuote = {
      quote: selectedQuote,
      translation: translation || selectedQuote, // fallback to same text if translation fails
      author: selectedAuthor,
      date: todayKey,
    };

    return NextResponse.json(cachedQuote);
  } catch (error) {
    console.error('GET /api/motivational-quote error:', error);

    const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    const todayKey = getTodayKey();
    cachedQuote = { quote: fallback.quote, translation: fallback.translation, author: fallback.author, date: todayKey };
    return NextResponse.json(cachedQuote);
  }
}