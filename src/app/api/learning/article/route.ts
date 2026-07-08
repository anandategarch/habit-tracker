import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, subDays, format, differenceInDays } from 'date-fns';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache for article (per day per topic)
let cachedArticle: {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
  date: string;
} | null = null;

function getTodayKey(): string {
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + jakartaOffset * 60000);
  return jakarta.toISOString().split('T')[0];
}

// Search queries per topic
const TOPIC_QUERIES: Record<string, string[]> = {
  default: [
    'pengertian dasar {topic} dalam bahasa indonesia',
    'konsep {topic} untuk pemula',
    'materi belajar {topic} ringkas',
  ],
};

function getSearchQueries(topic: string): string[] {
  return TOPIC_QUERIES.default.map(q => q.replace('{topic}', topic));
}

// Fallback articles
const FALLBACK_ARTICLES: Record<string, { title: string; content: string; funFact: string }[]> = {
  Akuntansi: [
    {
      title: 'Mengenal Double-Entry Bookkeeping',
      content: 'Double-entry bookkeeping adalah sistem pencatatan akuntansi di mana setiap transaksi dicatat dalam dua akun berbeda: sisi debit dan sisi kredit. Prinsip dasarnya adalah "setiap debit memiliki kredit yang setara." Misalnya, ketika perusahaan membeli perlengkapan seharga Rp1.000.000 secara tunai, maka akun Perlengkapan akan didebit (bertambah) dan akun Kas akan dikredit (berkurang) dengan jumlah yang sama.\n\nSistem ini pertama kali didokumentasikan oleh Luca Pacioli pada tahun 1494 dalam bukunya "Summa de Arithmetica." Hingga kini, double-entry bookkeeping menjadi fondasi dari seluruh sistem akuntansi modern di dunia. Tanpa sistem ini, perusahaan tidak akan bisa menyusun laporan keuangan yang akurat seperti neraca, laporan laba rugi, dan arus kas.',
      funFact: 'Sistem pembukuan ganda (double-entry) pertama kali digunakan secara luas oleh pedagang di Venice, Italia pada abad ke-13, jauh sebelum Luca Pacioli menuliskannya secara formal.',
    },
    {
      title: 'Apa Itu Laporan Arus Kas?',
      content: 'Laporan arus kas (cash flow statement) adalah salah satu dari tiga laporan keuangan utama yang wajib disusun perusahaan. Laporan ini mencatat semua penerimaan dan pengeluaran kas dalam periode tertentu, dikelompokkan menjadi tiga aktivitas: operasional, investasi, dan pembiayaan.\n\nAktivitas operasional mencakup kas dari kegiatan bisnis inti, seperti penerimaan dari pelanggan dan pembayaran kepada pemasok. Aktivitas investasi terkait pembelian dan penjualan aset jangka panjang. Aktivitas pembiayaan melibatkan transaksi dengan pemilik dan kreditur, seperti penerbitan saham atau pembayaran dividen. Banyak perusahaan yang tampak menguntungkan di laporan laba rugi justru mengalami kebangkrutan karena arus kasnya negatif.',
      funFact: 'Krisis keuangan Asia 1997 menunjukkan bahwa banyak perusahaan besar yang "untung di atas kertas" namun bangkrut karena tidak memiliki cukup kas untuk membayar hutang jangka pendeknya.',
    },
  ],
  Keuangan: [
    {
      title: 'Konsep Bunga Majemuk: Keajaiban Waktu dalam Investasi',
      content: 'Bunga majemuk (compound interest) sering disebut sebagai "keajaiban dunia kedelapan" oleh Albert Einstein. Prinsipnya sederhana: bunga yang kamu peroleh akan menghasilkan bunga lagi di periode berikutnya. Semakin lama uangmu "bekerja," semakin besar hasilnya secara eksponensial.\n\nSebagai contoh, jika kamu menginvestasikan Rp1.000.000 dengan bunga 10% per tahun, setelah tahun pertama kamu memiliki Rp1.100.000. Di tahun kedua, bunga dihitung dari Rp1.100.000 (bukan Rp1.000.000 lagi), sehingga menjadi Rp1.210.000. Setelah 20 tahun, uangmu sudah berkembang menjadi sekitar Rp6.727.500 tanpa menambahkan sepeser pun. Inilah mengapa memulai investasi sedini mungkin sangat krusial.',
      funFact: 'Jika Benjamin Franklin hidup di era modern, dia akan sangat bangga: dalam wasiatnya, dia meninggalkan £1.000 each untuk kota Philadelphia dan Boston dengan instruksi untuk diinvestasikan selama 200 tahun. Hasilnya? Masing-masing kota menerima jutaan dolar.',
    },
  ],
  Ekonomi: [
    {
      title: 'Hukum Penawaran dan Permintaan',
      content: 'Hukum penawaran dan permintaan adalah prinsip paling fundamental dalam ilmu ekonomi. Hukum permintaan menyatakan bahwa ketika harga suatu barang naik, jumlah barang yang diminta konsumen akan turun, dan sebaliknya. Sementara hukum penawaran menyatakan bahwa ketika harga naik, produsen akan terdorong untuk memproduksi lebih banyak.\n\nTitik pertemuan antara kurva penawaran dan permintaan disebut titik keseimbangan (equilibrium), di mana jumlah barang yang diminta sama persis dengan jumlah yang ditawarkan. Jika harga di atas keseimbangan, akan terjadi kelebihan penawaran (surplus). Jika di bawah keseimbangan, terjadi kekurangan (shortage). Konsep ini menjelaskan mengapa harga cabai bisa melonjak drastis saat musim hujan dan turun saat panen raya.',
      funFact: 'Pada tahun 1840, irlandia mengalami kelaparan besar (Great Famine) bukan karena tidak ada makanan di dunia, melainkan karena hukum penawaran-permintaan: semua hasil panen diekspor ke Inggris karena harga yang lebih tinggi di sana.',
    },
  ],
  Pajak: [
    {
      title: 'Memahami Sistem Pajak Penghasilan (PPh)',
      content: 'Pajak Penghasilan (PPh) adalah pajak yang dikenakan atas penghasilan yang diterima oleh orang pribadi atau badan usaha dalam satu tahun pajak. Di Indonesia, PPh dibagi menjadi beberapa jenis berdasarkan sumber penghasilannya, seperti PPh 21 untuk penghasilan pegawai, PPh 23 untuk jasa, PPh 25 untuk pajak yang harus dibayar sendiri, dan PPh 29 untuk pelunasan.\n\nUntuk wajib pajak orang pribadi (OP), Indonesia menggunakan sistem Progressive Tax Rate atau tarif progresif. Artinya, semakin tinggi penghasilanmu, semakin tinggi persentase pajaknya. Penghasilan kena pajak (PKP) dihitung dengan mengurangkan penghasilan bruto dengan Penghasilan Tidak Kena Pajak (PTKP), biaya jabatan, iuran pensiun, dan pengurangan lainnya yang diizinkan.',
      funFact: 'Indonesia menggunakan NPWP (Nomor Pokok Wajib Pajak) yang terdiri dari 15 digit. Angka pertama menunjukkan jenis Wajib Pajak: 0 untuk OP, 1 untuk badan usaha, 2 untuk pemotongan pajak, dan seterusnya.',
    },
  ],
  Investasi: [
    {
      title: 'Saham vs Obligasi: Mana yang Lebih Cocok?',
      content: 'Saham dan obligasi adalah dua instrumen investasi yang paling populer, namun memiliki karakteristik yang sangat berbeda. Saham merepresentasikan kepemilikan di perusahaan. Ketika kamu membeli saham, kamu menjadi pemilik sebagian perusahaan tersebut dan berhak atas keuntungan (dividen) serta pertumbuhan nilai saham. Namun risikonya juga tinggi — jika perusahaan bangkrut, sahammu bisa menjadi nol.\n\nObligasi, di sisi lain, adalah surat utang. Ketika kamu membeli obligasi, kamu meminjamkan uang kepada penerbit (pemerintah atau perusahaan) dan berhak atas bunga tetap ditambah pengembalian pokok di masa depan. Risikonya lebih rendah dari saham, namun potensi keuntungannya juga lebih terbatas. Kombinasi keduanya dalam portofolio (asset allocation) adalah strategi yang umum digunakan investor untuk menyeimbangkan risiko dan return.',
      funFact: 'Saham BBCA (Bank Central Asia) adalah saham dengan kapitalisasi pasar terbesar di Indonesia, mencapai lebih dari Rp1.000 triliun. Jika kamu berinvestasi Rp10 juta di BBCA pada tahun 2000, nilainya sudah berkembang ratusan kali lipat hari ini.',
    },
  ],
  Manajemen: [
    {
      title: 'Prinsip Manajemen Modern: Dari Taylor hingga Agile',
      content: 'Manajemen modern telah berevolusi dari pendekatan yang sangat mekanis menjadi lebih humanis dan adaptif. Frederick Taylor mempelopori Scientific Management pada akhir 1800-an, yang berfokus pada efisiensi melalui pengukuran dan standarisasi. Kemudian, Elton Mayo membuktikan melalui eksperimen Hawthorne bahwa faktor sosial dan psikologis pekerja sama pentingnya dengan efisiensi fisik.\n\nDi era digital, metodologi Agile telah mengubah cara tim bekerja. Alih-alih perencanaan bertahap yang kaku (waterfall), Agile mengedepankan iterasi cepat, kolaborasi lintas fungsi, dan responsivitas terhadap perubahan. Prinsip-prinsip ini tidak hanya digunakan di industri teknologi, tetapi sudah diadopsi oleh berbagai sektor mulai dari perbankan hingga kesehatan.',
      funFact: 'Toyota Production System (TPS) yang dikembangkan oleh Taiichi Ohno di tahun 1950-an menjadi inspirasi utama metodologi Lean dan Agile yang digunakan oleh perusahaan teknologi dunia saat ini, termasuk Spotify dan Netflix.',
    },
  ],
};

const DEFAULT_FALLBACK = {
  title: 'Pentingnya Literasi Keuangan',
  content: 'Literasi keuangan adalah kemampuan untuk memahami dan menggunakan berbagai konsep keuangan secara efektif, termasuk mengelola keuangan pribadi, memahami investasi, dan membuat keputusan finansial yang bijak. Menurut survei OJK, tingkat literasi keuangan di Indonesia masih relatif rendah dibandingkan negara-negara ASEAN lainnya.\n\nMemahami konsep dasar seperti budgeting, saving, compound interest, dan diversifikasi risiko sangat penting untuk mencapai kesejahteraan finansial jangka panjang. Banyak orang yang berpenghasilan tinggi tetapi tidak mampu menabung karena kurangnya perencanaan keuangan. Sebaliknya, orang yang melek keuangan mampu memaksimalkan penghasilannya melalui perencanaan yang tepat.',
  funFact: 'Menurut laporan Global Financial Literacy Survey, hanya sekitar 38% populasi dewasa di Indonesia yang memahami konsep keuangan dasar seperti bunga majemuk dan inflasi.',
};

async function summarizeArticle(zai: Awaited<ReturnType<typeof ZAI.create>>, pageTitle: string, pageText: string, topic: string): Promise<{ title: string; content: string; funFact: string }> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah asisten pembelajaran keuangan dan ekonomi. Tugasmu adalah membuat ringkasan artikel edukatif dalam bahasa Indonesia.

FORMAT OUTPUT (WAJIB JSON valid, tanpa markdown code block):
{
  "title": "Judul artikel yang menarik",
  "content": "Ringkasan artikel 200-350 kata dalam bahasa Indonesia. Tulis dalam 3-4 paragraf yang mengalir. Jelas dan mudah dipahami. Gunakan contoh konkretnya. JANGAN gunakan format list/bullet. Gunakan paragraf naratif.",
  "funFact": "Satu fakta menarik terkait topik dalam 1-2 kalimat. Bisa berupa data statistik, sejarah, atau trivia yang mengejutkan."
}

PENTING: Output HANYA JSON valid, tanpa teks tambahan apapun sebelum atau sesudah.`,
        },
        {
          role: 'user',
          content: `Buatkan ringkasan edukatif tentang topik "${topic}" berdasarkan konten berikut:

Judul: ${pageTitle}
Konten: ${pageText.substring(0, 3000)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    // Try to extract JSON from possible markdown code blocks
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.content && parsed.funFact) {
        return {
          title: parsed.title,
          content: parsed.content,
          funFact: parsed.funFact,
        };
      }
    }
  } catch (e) {
    console.error('Summarization failed:', e);
  }
  return { title: '', content: '', funFact: '' };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || '';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const todayKey = getTodayKey();

    // Check cache
    if (!forceRefresh && cachedArticle && cachedArticle.date === todayKey && cachedArticle.topic === topic) {
      return NextResponse.json(cachedArticle);
    }

    // Check fallback articles first
    const fallbacks = FALLBACK_ARTICLES[topic] || [];
    if (fallbacks.length > 0 && !forceRefresh) {
      const idx = Math.floor(Math.random() * fallbacks.length);
      const fb = fallbacks[idx];
      cachedArticle = { ...fb, topic, source: 'fallback', date: todayKey };
      return NextResponse.json(cachedArticle);
    }

    // Try to fetch from internet
    const zai = await ZAI.create();
    const queries = getSearchQueries(topic);
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];

    let article = { title: '', content: '', funFact: '' };

    try {
      // Step 1: Web search
      const searchResults = await zai.functions.invoke('web_search', {
        query: randomQuery,
        num: 8,
      });

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        // Find a good result (has URL, decent snippet)
        const goodResults = (searchResults as Array<{ url?: string; name?: string; snippet?: string }>)
          .filter(r => r.url && r.snippet && r.snippet.length > 50);

        if (goodResults.length > 0) {
          const selected = goodResults[Math.floor(Math.random() * Math.min(3, goodResults.length))];

          // Step 2: Read the page
          try {
            const pageResult = await zai.functions.invoke('page_reader', {
              url: selected.url!,
            });

            const pageData = (pageResult as { data?: { title?: string; html?: string } })?.data;
            const pageTitle = pageData?.title || selected.name || topic;
            const rawHtml = pageData?.html || '';
            // Strip HTML tags for plain text
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
              // Step 3: Summarize with LLM
              article = await summarizeArticle(zai, pageTitle, plainText, topic);
            }
          } catch {
            // Page reader failed, try summarizing from snippets
            const allSnippets = goodResults
              .map(r => `${r.name}: ${r.snippet}`)
              .join('\n\n');

            if (allSnippets.length > 200) {
              article = await summarizeArticle(zai, topic, allSnippets, topic);
            }
          }
        }
      }
    } catch (e) {
      console.error('Web fetch failed:', e);
    }

    // Use fallback if summarization didn't work
    if (!article.title || !article.content) {
      if (fallbacks.length > 0) {
        const idx = Math.floor(Math.random() * fallbacks.length);
        article = fallbacks[idx];
      } else {
        article = DEFAULT_FALLBACK;
      }
    }

    cachedArticle = {
      title: article.title,
      content: article.content,
      funFact: article.funFact,
      topic,
      source: article.title !== (fallbacks.find(f => f.title === article.title)?.title || '') ? 'web' : 'fallback',
      date: todayKey,
    };

    return NextResponse.json(cachedArticle);
  } catch (error) {
    console.error('GET /api/learning/article error:', error);

    // Return fallback
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

// GET /api/learning/article?streak=true — Get learning streak
export async function POST() {
  // Streak endpoint handled by GET with streak param, this is unused
  return NextResponse.json({ error: 'Use GET' }, { status: 405 });
}