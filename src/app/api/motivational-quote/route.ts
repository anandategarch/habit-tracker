import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory daily cache
let cachedQuote: { quote: string; author: string; date: string } | null = null;

function getTodayKey(): string {
  const now = new Date();
  // Use Asia/Jakarta timezone
  const jakartaOffset = 7 * 60; // UTC+7
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + jakartaOffset * 60000);
  return jakarta.toISOString().split('T')[0];
}

function cleanQuote(text: string): string {
  // Remove common prefixes/suffixes from snippets
  let cleaned = text
    .replace(/^["""''«]/, '')
    .replace(/["""''»]$/, '')
    .trim();
  // Remove leading "..." or trailing "..."
  cleaned = cleaned.replace(/^\.{3,}\s*/, '').replace(/\s*\.{3,}$/, '');
  // Ensure it ends with proper punctuation
  if (!/[.!?,;:]$/.test(cleaned)) cleaned += '.';
  return cleaned;
}

export async function GET() {
  try {
    const todayKey = getTodayKey();

    // Return cached quote if still valid for today
    if (cachedQuote && cachedQuote.date === todayKey) {
      return NextResponse.json(cachedQuote);
    }

    const zai = await ZAI.create();

    // Search for motivational quotes in Indonesian
    const quoteTopics = [
      'kata kata motivasi hidup singkat bermakna',
      'kutipan motivasi inspiratif untuk hari ini',
      'quotes motivasi pagi hari penyemangat',
    ];

    // Pick a random topic for variety
    const randomTopic = quoteTopics[Math.floor(Math.random() * quoteTopics.length)];

    const results = await zai.functions.invoke('web_search', {
      query: randomTopic,
      num: 10,
    });

    if (!Array.isArray(results) || results.length === 0) {
      // Fallback quotes if search fails
      const fallbacks = [
        { quote: 'Setiap hari adalah kesempatan baru untuk menjadi lebih baik.', author: 'Anonymous' },
        { quote: 'Kesuksesan bukanlah kunci kebahagiaan. Kebahagiaan adalah kunci kesuksesan.', author: 'Albert Schweitzer' },
        { quote: 'Jangan takut gagal, takutlah untuk tidak mencoba.', author: 'Anonymous' },
        { quote: 'Masa depan milik mereka yang percaya pada keindahan mimpi mereka.', author: 'Eleanor Roosevelt' },
        { quote: 'Langkah kecil setiap hari akan membawa perubahan besar.', author: 'Anonymous' },
        { quote: 'Kegagalan adalah guru terbaik, jika kamu mau belajar darinya.', author: 'Anonymous' },
        { quote: 'Disiplin adalah jembatan antara tujuan dan pencapaian.', author: 'Jim Rohn' },
      ];
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      cachedQuote = { ...fallback, date: todayKey };
      return NextResponse.json(cachedQuote);
    }

    // Try to extract a clean quote from search results
    // Look for results that look like actual quote pages
    let selectedSnippet = '';
    let selectedAuthor = 'Anonymous';

    // Prioritize results that contain quote-like content
    const quoteResults = results.filter(
      (r: { snippet?: string; name?: string }) =>
        r.snippet &&
        r.snippet.length > 30 &&
        r.snippet.length < 300 &&
        (r.name?.toLowerCase().includes('kata') ||
          r.name?.toLowerCase().includes('motivasi') ||
          r.name?.toLowerCase().includes('quote') ||
          r.name?.toLowerCase().includes('kutipan') ||
          r.snippet.includes('"') ||
          r.snippet.includes('"'))
    );

    const source = quoteResults.length > 0
      ? quoteResults[Math.floor(Math.random() * Math.min(3, quoteResults.length))]
      : results[Math.floor(Math.random() * Math.min(5, results.length))];

    if (source?.snippet) {
      selectedSnippet = cleanQuote(source.snippet);

      // Try to extract author from name or snippet
      const authorMatch = (source.name + ' ' + source.snippet).match(/[-–—]\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
      if (authorMatch) {
        selectedAuthor = authorMatch[1].trim();
      }
    }

    // If the snippet is too long, try to truncate at a sentence boundary
    if (selectedSnippet.length > 200) {
      const sentenceEnd = selectedSnippet.search(/[.!?]\s/);
      if (sentenceEnd > 40) {
        selectedSnippet = selectedSnippet.substring(0, sentenceEnd + 1);
      } else {
        selectedSnippet = selectedSnippet.substring(0, 200).replace(/\s+\S*$/, '') + '...';
      }
    }

    // Final fallback if extraction failed
    if (!selectedSnippet || selectedSnippet.length < 15) {
      selectedSnippet = 'Setiap langkah kecil yang kamu ambil hari ini membawamu lebih dekat ke impianmu. Teruslah maju!';
      selectedAuthor = 'Anonymous';
    }

    cachedQuote = {
      quote: selectedSnippet,
      author: selectedAuthor,
      date: todayKey,
    };

    return NextResponse.json(cachedQuote);
  } catch (error) {
    console.error('GET /api/motivational-quote error:', error);

    // Return a fallback quote on error
    const fallbacks = [
      { quote: 'Setiap hari adalah kesempatan baru untuk menjadi lebih baik.', author: 'Anonymous' },
      { quote: 'Kesuksesan dimulai dari pikiran positif dan tindakan nyata.', author: 'Anonymous' },
      { quote: 'Jangan menunggu sempurna, mulailah dari sekarang.', author: 'Anonymous' },
    ];
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const todayKey = getTodayKey();
    cachedQuote = { ...fallback, date: todayKey };
    return NextResponse.json(cachedQuote);
  }
}