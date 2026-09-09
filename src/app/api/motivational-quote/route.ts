// GET /api/motivational-quote — kutipan motivasi harian (fallback statis Indonesia).
//
// Fix 11-c M-4: ?refresh=1 → pilih kutipan RANDOM non-repeat dari daftar
// (menghindari teks yang sedang ditampilkan — dikirim klien via ?exclude=).
// Tanpa param: tetap deterministik per hari Jakarta (stabil seharian).
import { NextResponse } from 'next/server';
import { MOTIVATIONAL_QUOTES, pickDailyQuote } from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const refresh = params.get('refresh') === '1';
    const exclude = params.get('exclude') ?? '';
    let quote = pickDailyQuote();
    if (refresh) {
      // Random non-repeat: hindari kutipan yang sedang tampil (exclude);
      // bila seluruh daftar ter-exclude (teori), pakai pool penuh.
      const pool = MOTIVATIONAL_QUOTES.filter((q) => !exclude || q.text !== exclude);
      const source = pool.length > 0 ? pool : MOTIVATIONAL_QUOTES;
      quote = source[Math.floor(Math.random() * source.length)];
    }
    return NextResponse.json({ text: quote.text, author: quote.author });
  } catch (error) {
    // Fallback terakhir bila helper gagal — jangan biarkan 500.
    void error;
    return NextResponse.json({
      text: 'Kebiasaan kecil yang konsisten mengalahkan motivasi besar yang datang sesekali.',
      author: 'Rutina',
    });
  }
}
