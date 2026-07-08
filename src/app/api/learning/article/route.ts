import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface ArticleData {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
  date: string;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

// Cache: keyed by "date|topic" → article
const articleCache = new Map<string, ArticleData>();

// Track recently shown titles to avoid repeats (per topic, last 20)
const seenTitles = new Map<string, string[]>();

function getTodayKey(): string {
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + jakartaOffset * 60000);
  return jakarta.toISOString().split('T')[0];
}

function addSeenTitle(topic: string, title: string) {
  const list = seenTitles.get(topic) || [];
  if (!list.includes(title)) {
    list.push(title);
    if (list.length > 20) list.shift();
    seenTitles.set(topic, list);
  }
}

function getSeenTitles(topic: string): string[] {
  return seenTitles.get(topic) || [];
}

// ── Search queries: 15+ per default topic, 5+ generic ───────────────────────

const TOPIC_QUERIES: Record<string, string[]> = {
  Akuntansi: [
    'prinsip akuntansi dasar indonesia terbaru',
    'cara membuat jurnal umum akuntansi',
    'laporan keuangan perusahaan contoh',
    'neraca saldo dan penyesuaian akuntansi',
    'akuntansi biaya pengertian dan contoh',
    'standar akuntansi keuangan PSAK terbaru',
    'audit keuangan prosedur dan teknik',
    'akuntansi manajemen fungsi dan peran',
    'cash flow statement analisis',
    'depresiasi aset tetap metode',
    'akuntansi perpajakan dasar',
    'rekonsiliasi bank langkah langkah',
    'akuntansi sewa IFRS 16 penjelasan',
    'working paper akuntansi lengkap',
    'etika profesi akuntan publik',
    'akuntansi forensik fraud detection',
    'modul akuntansi dasar untuk pemula',
    'analisis rasio keuangan perusahaan',
  ],
  Keuangan: [
    'manajemen keuangan pribadi tips',
    'cara membuat anggaran bulanan efektif',
    'investasi reksa dana untuk pemula',
    'financial literacy Indonesia statistik',
    'cara melunasi hutang dengan cepat',
    'dana darurat berapa jumlah ideal',
    'finansial planning jangka pendek menengah',
    'kredit pinjaman bunga efektif',
    'asuransi jiwa kesehatan pentingnya',
    'keuangan syariah prinsip dan produk',
    'teknik mengatur keuangan gaji UMR',
    'wallet money management aplikasi',
    'passive income ide peluang 2024',
    'financial freedom cara mencapai',
    'tabungan vs investasi perbandingan',
    'pinjaman online risiko dan bahaya',
    'keuangan keluarga tips mengelola',
    'budgeting 50 30 20 metode',
  ],
  Ekonomi: [
    'pengertian inflasi dampak indonesia',
    'suku bunga bank indonesia kebijakan',
    'ekonomi makro mikro perbedaan',
    'PDB pertumbuhan ekonomi Indonesia',
    'ekonomi digital Indonesia tren 2024',
    'supply demand contoh kasus nyata',
    'ekonomi kreatif peluang UMKM',
    'fungsi uang dalam perekonomian',
    'kebijakan fiskal moneter pemerintah',
    'ekonomi global pengaruh terhadap Indonesia',
    'deflasi penyebab dan dampaknya',
    'ekonomi kerakyatan konsep Wendell',
    'perdagangan internasional manfaat',
    'OJK peran fungsi regulasi',
    'ekonomi pancasila prinsip dasar',
    'market structure persaingan sempurna',
    'ekonomi perilaku behavioral economics',
    'kemiskinan inequality Indonesia data',
  ],
  Pajak: [
    'panduan PPh 21 karyawan terbaru',
    'cara menghitung PPN perusahaan',
    'SPT tahunan cara lapor online',
    'NPWP pendaftaran cara dan syarat',
    'pajak penghasilan tarif progresif',
    'tax planning strategi legal',
    'pajak UMKM insentif dan keringanan',
    'e-filing DJP Online tutorial lengkap',
    'pajak digital economy regulasi',
    'transfer pricing aturan internasional',
    'pajak properti PBB dan BPHTB',
    'pajak deklarasi amnesty program',
    'self assessment system pajak',
    'konsultan pajak kapan butuh',
    'pajak ekspor impor bea cukai',
    'pajak crypto aset kripto aturan',
    'tax amnesty jilid 3 berita',
    'faktur pajak elektronik e-Faktur',
  ],
  Investasi: [
    'cara investasi saham pemula indonesia',
    'analisis fundamental saham langkah',
    'reksa dana pasar uang vs saham',
    'investasi emas keuntungan risiko',
    'portofolio investasi diversifikasi',
    'IPO saham peluang dan risiko',
    'investasi properti strategi jangka panjang',
    ' ETF exchange traded fund indonesia',
    'P2P lending investasi fintech',
    'analisis teknikal saham dasar',
    'investasi obligasi surat berharga negara',
    'dividen saham pengertian dan contoh',
    'margin trading saham risiko',
    'investasi startup equity crowdfunding',
    'rebalancing portofolio strategi',
    'warren buffett prinsip investasi value',
    'investasi syariah sukuk dan reksa',
    'saham blue chip LQ45 daftar',
  ],
  Manajemen: [
    'prinsip manajemen fungsi perencanaan',
    'leadership style kepemimpinan efektif',
    'manajemen waktu productivity tips',
    'manajemen proyek agile scrum',
    'strategic management analisis SWOT',
    'manajemen sumber daya manusia SDM',
    'organizational culture perusahaan',
    'manajemen risiko framework enterprise',
    'team building aktivitas efektif',
    'manajemen perubahan change management',
    'decision making proses pengambilan',
    'KPI OKR perbedaan implementasi',
    'manajemen operasional efisiensi',
    'remote work manajemen tim jarak jauh',
    'manajemen konflik di tempat kerja',
    'entrepreneurship kewirausahaan dasar',
    'manajemen stres burnout kerja',
    'balanced scorecard implementasi',
  ],
  default: [
    'materi {topic} dasar untuk pemula',
    'pengertian {topic} dalam bahasa indonesia',
    'konsep {topic} aplikasi nyata',
    'belajar {topic} tips cepat',
    'tantangan {topic} di Indonesia',
    'perkembangan {topic} terbaru 2024',
    '{topic} studi kasus Indonesia',
    'karir {topic} peluang profesi',
    'tools {topic} software terbaik',
    '{topic} vs alternatif perbandingan',
  ],
};

function getSearchQueries(topic: string): string[] {
  const specific = TOPIC_QUERIES[topic];
  if (specific) return specific;
  return TOPIC_QUERIES.default.map(q => q.replace('{topic}', topic));
}

// ── Fallback articles (expanded, 3 per topic) ────────────────────────────────

const FALLBACK_ARTICLES: Record<string, { title: string; content: string; funFact: string }[]> = {
  Akuntansi: [
    {
      title: 'Mengenal Double-Entry Bookkeeping: Fondasi Akuntansi Modern',
      content: 'Double-entry bookkeeping adalah sistem pencatatan akuntansi di mana setiap transaksi dicatat dalam dua akun berbeda: sisi debit dan sisi kredit. Prinsip dasarnya adalah "setiap debit memiliki kredit yang setara." Misalnya, ketika perusahaan membeli perlengkapan seharga Rp1.000.000 secara tunai, maka akun Perlengkapan akan didebit (bertambah) dan akun Kas akan dikredit (berkurang) dengan jumlah yang sama.\n\nSistem ini pertama kali didokumentasikan oleh Luca Pacioli pada tahun 1494 dalam bukunya "Summa de Arithmetica." Hingga kini, double-entry bookkeeping menjadi fondasi dari seluruh sistem akuntansi modern di dunia. Tanpa sistem ini, perusahaan tidak akan bisa menyusun laporan keuangan yang akurat seperti neraca, laporan laba rugi, dan arus kas.\n\nDalam praktiknya, setiap transaksi akan mempengaruhi setidaknya dua akun. Misalnya, ketika perusahaan menjual barang secara kredit, akun Piutang Usaha akan didebit (aset bertambah) dan akun Pendapatan Penjualan akan dikredit (pendapatan bertambah). Jika barang tersebut memiliki harga pokok, maka akun Harga Pokok Penjualan akan didebit (beban bertambah) dan akun Persediaan Barang Dagang akan dikredit (aset berkurang).\n\nKeunggulan utama dari sistem ini adalah kemampuannya untuk mendeteksi kesalahan. Karena total debit harus selalu sama dengan total kredit, setiap ketidakseimbangan menandakan adanya kesalahan pencatatan yang perlu dilacak. Ini memberikan mekanisme kontrol internal yang sangat berharga bagi bisnis.',
      funFact: 'Sistem pembukuan ganda (double-entry) pertama kali digunakan secara luas oleh pedagang di Venice, Italia pada abad ke-13, jauh sebelum Luca Pacioli menuliskannya secara formal.',
    },
    {
      title: 'Apa Itu Laporan Arus Kas dan Mengapa Sangat Penting?',
      content: 'Laporan arus kas (cash flow statement) adalah salah satu dari tiga laporan keuangan utama yang wajib disusun perusahaan. Laporan ini mencatat semua penerimaan dan pengeluaran kas dalam periode tertentu, dikelompokkan menjadi tiga aktivitas: operasional, investasi, dan pembiayaan.\n\nAktivitas operasional mencakup kas dari kegiatan bisnis inti, seperti penerimaan dari pelanggan dan pembayaran kepada pemasok. Aktivitas investasi terkait pembelian dan penjualan aset jangka panjang seperti tanah, bangunan, dan peralatan. Aktivitas pembiayaan melibatkan transaksi dengan pemilik dan kreditur, seperti penerbitan saham, pembayaran dividen, dan pinjaman bank.\n\nBanyak perusahaan yang tampak menguntungkan di laporan laba rugi justru mengalami kebangkrutan karena arus kasnya negatif. Fenomena ini dikenal sebagai "profitable but cash poor." Sebagai contoh, perusahaan bisa melaporkan laba bersih yang tinggi karena penjualan kreditnya besar, namun jika pelanggan tidak membayar tepat waktu, kas di rekening perusahaan bisa kosong.\n\nAnalisis arus kas juga membantu investor menilai kualitas laba perusahaan. Laba yang didukung oleh arus kas operasional yang kuat dianggap lebih berkualitas dibandingkan laba yang berasal dari transaksi non-kas atau manipulasi akuntansi. Oleh karena itu, para analis keuangan selalu membandingkan laba bersih dengan arus kas operasional sebagai salah satu indikator kesehatan keuangan perusahaan.',
      funFact: 'Krisis keuangan Asia 1997 menunjukkan bahwa banyak perusahaan besar yang "untung di atas kertas" namun bangkrut karena tidak memiliki cukup kas untuk membayar hutang jangka pendeknya.',
    },
    {
      title: 'Memahami Prinsip Matching dalam Akuntansi',
      content: 'Prinsip matching (prinsip penandingan) adalah salah satu prinsip paling fundamental dalam akuntansi akrual. Prinsip ini menyatakan bahwa pendapatan harus diakui pada periode yang sama dengan beban yang dikeluarkan untuk menghasilkan pendapatan tersebut. Dengan kata lain, upaya (biaya) harus dicocokkan dengan hasil (pendapatan) dalam periode yang sama.\n\nSebagai contoh, jika sebuah toko membeli barang dagangan seharga Rp50.000.000 pada bulan Januari namun baru menjualnya pada bulan Maret, maka biaya pembelian barang tersebut tidak langsung diakui sebagai beban di Januari. Sebaliknya, biaya tersebut baru diakui sebagai Harga Pokok Penjualan (HPP) pada bulan Maret ketika pendapatan penjualannya diakui.\n\nPrinsip ini berbeda dengan akuntansi kas (cash basis) di mana pendapatan dan beban baru diakui ketika kas benar-benar diterima atau dikeluarkan. Dalam akuntansi akrual, prinsip matching memastikan bahwa laporan laba rugi mencerminkan kinerja ekonomi suatu periode secara akurat, bukan sekadar mencatat arus kas masuk dan keluar.\n\nPenerapan prinsip matching juga melibatkan konsep akrual dan deferral. Akrual adalah pengakuan pendapatan atau beban sebelum kas diterima atau dikeluarkan, seperti piutang dan beban yang masih harus dibayar. Deferral adalah penundaan pengakuan pendapatan atau beban yang sudah diterima atau dibayar dalam bentuk kas.',
      funFact: 'Prinsip matching pertama kali diperkenalkan oleh American Institute of Accountants (sekarang AICPA) pada tahun 1930-an dan menjadi dasar GAAP (Generally Accepted Accounting Principles) yang digunakan hingga saat ini.',
    },
  ],
  Keuangan: [
    {
      title: 'Konsep Bunga Majemuk: Keajaiban Waktu dalam Investasi',
      content: 'Bunga majemuk (compound interest) sering disebut sebagai "keajaiban dunia kedelapan" oleh Albert Einstein. Prinsipnya sederhana: bunga yang kamu peroleh akan menghasilkan bunga lagi di periode berikutnya. Semakin lama uangmu "bekerja," semakin besar hasilnya secara eksponensial.\n\nSebagai contoh, jika kamu menginvestasikan Rp1.000.000 dengan bunga 10% per tahun, setelah tahun pertama kamu memiliki Rp1.100.000. Di tahun kedua, bunga dihitung dari Rp1.100.000 (bukan Rp1.000.000 lagi), sehingga menjadi Rp1.210.000. Setelah 20 tahun, uangmu sudah berkembang menjadi sekitar Rp6.727.500 tanpa menambahkan sepeser pun. Inilah mengapa memulai investasi sedini mungkin sangat krusial.\n\nRumus bunga majemuk adalah A = P(1 + r/n)^(nt), di mana A adalah jumlah akhir, P adalah pokok awal, r adalah suku bunga tahunan, n adalah frekuensi penggabungan bunga per tahun, dan t adalah waktu dalam tahun. Semakin sering bunga digabungkan (misalnya bulanan atau harian), semakin besar hasilnya dibandingkan penggabungan tahunan.\n\nBunga majemuk juga bekerja dua arah. Di sisi positif, ia memperbesar kekayaanmu. Di sisi negatif, ia memperbesar hutangmu. Kartu kredit yang tidak dibayar lunas setiap bulan menerapkan bunga majemuk pada sisa tagihan, yang bisa membuat hutang kecil membengkak dengan sangat cepat. Inilah mengapa Warren Buffett menekankan pentingnya "jangan pernah kehilangan uang" — karena kehilangan 50% berarti kamu membutuhkan 100% gain untuk kembali ke posisi semula.',
      funFact: 'Jika Benjamin Franklin hidup di era modern, dia akan sangat bangga: dalam wasiatnya, dia meninggalkan £1.000 each untuk kota Philadelphia dan Boston dengan instruksi untuk diinvestasikan selama 200 tahun. Hasilnya? Masing-masing kota menerima jutaan dolar.',
    },
    {
      title: 'Metode Budgeting 50/30/20: Atur Keuangan Tanpa Ribet',
      content: 'Metode 50/30/20 adalah salah satu teknik pengelolaan keuangan paling populer dan mudah diterapkan. Diperkenalkan oleh Senator Elizabeth Warren dalam bukunya "All Your Worth," metode ini membagi penghasilan bersih bulanan ke dalam tiga kategori: 50% untuk kebutuhan (needs), 30% untuk keinginan (wants), dan 20% untuk tabungan dan pembayaran hutang.\n\nKategori kebutuhan mencakup semua pengeluaran yang mutlak diperlukan untuk bertahan hidup, seperti biaya makan, sewa rumah atau cicilan KPR, tagihan listrik dan air, transportasi ke tempat kerja, asuransi, dan pembayaran hutang minimum. Jika total pengeluaran kebutuhanmu melebihi 50% dari penghasilan, mungkin saatnya mencari cara untuk menekan biaya hidup atau menambah sumber penghasilan.\n\nKategori keinginan mencakup pengeluaran yang meningkatkan kualitas hidup namun bukan kebutuhan mendasar, seperti makan di restoran, hiburan, langganan streaming, belanja pakaian di luar kebutuhan, dan liburan. Yang terpenting, kategori ini bukan berarti "boros" — justru mengalokasikan 30% untuk keinginan membantu mencegah "budget fatigue" yang sering membuat orang menyerah dalam mengelola keuangan.\n\nKategori 20% adalah kunci untuk membangun masa depan keuangan yang lebih baik. Ini mencakup tabungan darurat, investasi, pembayaran hutang lebih cepat, dan dana pensiun. Idealnya, dana darurat minimal 3-6 bulan pengeluaran disiapkan terlebih dahulu sebelum mulai berinvestasi secara agresif.',
      funFact: 'Sebuah studi oleh Harvard Business School menemukan bahwa orang yang menulis rencana keuangan mereka memiliki kemungkinan 2,5x lebih besar untuk menabung dibandingkan yang tidak.',
    },
    {
      title: 'Dana Darurat: Tameng Finansial yang Sering Diabaikan',
      content: 'Dana darurat (emergency fund) adalah sejumlah uang yang disisihkan khusus untuk menghadapi situasi tidak terduga seperti kehilangan pekerjaan, kecelakaan, sakit mendadak, atau perbaikan rumah yang mendesak. Banyak ahli keuangan menyepakati bahwa dana darurat minimal setara dengan 3 hingga 6 bulan pengeluaran rutin.\n\nMengapa 3-6 bulan? Karena rata-rata waktu untuk mencari pekerjaan baru di Indonesia berkisar antara 3-6 bulan, tergantung industri dan posisi. Dengan dana darurat yang memadai, kamu memiliki ruang bernafas finansial untuk mencari pekerjaan yang tepat tanpa harus menerima pekerjaan pertama yang muncul hanya karena kebutuhan uang mendesak.\n\nTempat menyimpan dana darurat sama pentingnya dengan jumlahnya. Dana darurat sebaiknya disimpan dalam instrumen yang likuid dan risikonya sangat rendah, seperti tabungan biasa, deposito, atau reksa dana pasar uang. Tujuannya bukan untuk mendapatkan return tinggi, melainkan memastikan uangnya bisa dicairkan kapan saja tanpa penalti. Jangan pernah menempatkan dana darurat di saham atau properti karena risiko fluktuasi nilainya.\n\nUntuk memulai, tentukan total pengeluaran bulananmu, lalu kalikan dengan minimal 3. Jika pengeluaranmu Rp5.000.000 per bulan, target dana darurat minimal Rp15.000.000. Mulailah dari yang kecil — sisihkan Rp100.000- Rp500.000 per bulan secara konsisten. Yang terpenting adalah memulai dan menjaga konsistensi.',
      funFact: 'Menurut survei OJK 2023, lebih dari 60% masyarakat Indonesia tidak memiliki dana darurat yang memadai, sehingga satu krisis kecil saja bisa menghancurkan keuangan keluarga.',
    },
  ],
  Ekonomi: [
    {
      title: 'Hukum Penawaran dan Permintaan: Fondasi Ekonomi Modern',
      content: 'Hukum penawaran dan permintaan adalah prinsip paling fundamental dalam ilmu ekonomi. Hukum permintaan menyatakan bahwa ketika harga suatu barang naik, jumlah barang yang diminta konsumen akan turun, dan sebaliknya. Sementara hukum penawaran menyatakan bahwa ketika harga naik, produsen akan terdorong untuk memproduksi lebih banyak.\n\nTitik pertemuan antara kurva penawaran dan permintaan disebut titik keseimbangan (equilibrium), di mana jumlah barang yang diminta sama persis dengan jumlah yang ditawarkan. Jika harga di atas keseimbangan, akan terjadi kelebihan penawaran (surplus). Jika di bawah keseimbangan, terjadi kekurangan (shortage). Konsep ini menjelaskan mengapa harga cabai bisa melonjak drastis saat musim hujan dan turun saat panen raya.\n\nDalam kenyataannya, banyak faktor yang dapat menggeser kurva penawaran dan permintaan di luar perubahan harga. Untuk kurva permintaan, faktor-faktor tersebut meliputi pendapatan konsumen, selera, harga barang substitusi dan komplementer, serta ekspektasi masa depan. Untuk kurva penawaran, faktor-faktor yang mempengaruhi termasuk biaya produksi, teknologi, jumlah penjual, dan kebijakan pemerintah berupa pajak atau subsidi.\n\nSalah satu penerapan menarik dari hukum ini adalah dalam kebijakan harga minimum (price floor) seperti upah minimum, dan harga maksimum (price ceiling) seperti harga masker saat pandemi. Kebijakan ini seringkali menciptakan ketidakseimbangan pasar yang perlu diantisipasi oleh pembuat kebijakan.',
      funFact: 'Pada tahun 1840, Irlandia mengalami kelaparan besar (Great Famine) bukan karena tidak ada makanan di dunia, melainkan karena hukum penawaran-permintaan: semua hasil panen diekspor ke Inggris karena harga yang lebih tinggi di sana.',
    },
    {
      title: 'Memahami Inflasi: Musuh Tersembunyi Kekayaanmu',
      content: 'Inflasi adalah peningkatan harga barang dan jasa secara umum dan terus-menerus dalam suatu periode tertentu. Ketika inflasi terjadi, daya beli uang menurun — Rp100.000 hari ini tidak akan bisa membeli sebanyak Rp100.000 lima tahun lalu. Bank Indonesia menargetkan inflasi sekitar 2-4% per tahun sebagai tingkat yang sehat bagi perekonomian.\n\nInflasi memiliki beberapa penyebab utama. Inflasi tarikan permintaan (demand-pull inflation) terjadi ketika permintaan agregat melebihi kapasitas produksi ekonomi, biasanya diiringi pertumbuhan ekonomi yang terlalu cepat. Inflasi dorongan biaya (cost-push inflation) terjadi ketika biaya produksi naik, misalnya karena kenaikan harga bahan baku atau upah pekerja, yang kemudian diteruskan ke harga jual.\n\nEfek inflasi terhadap masyarakat tidak merata. Mereka yang bergantung pada penghasilan tetap seperti pensiunan paling terdampak karena pendapatan mereka tidak meningkat secepat kenaikan harga. Sebaliknya, debitur (pihak yang berhutang) justru diuntungkan karena nilai riil hutang mereka berkurang. Inilah mengapa pemerintah yang memiliki hutang besar dalam mata uang sendiri cenderung "menyukai" inflasi moderat.\n\nUntuk melindungi kekayaan dari inflasi, ahli keuangan merekomendasikan untuk berinvestasi di instrumen yang return-nya di atas tingkat inflasi, seperti saham, properti, atau obligasi yang memberikan yield yang kompetitif. Menyimpan semua uang dalam bentuk kas di bawah kasur adalah cara paling cepat kehilangan daya beli.',
      funFact: 'Hyperinflation di Zimbabwe pada tahun 2008 mencapai 79,6 miliar persen per bulan. Harga barang bisa berlipat ganda dalam hitungan jam, dan uang kertas Rp100 triliun Zimbabwe hanya bernilai sekitar Rp40.000.',
    },
    {
      title: 'Bank Sentral dan Kebijakan Moneter: Mengatur Nadi Perekonomian',
      content: 'Bank sentral adalah lembaga yang bertanggung jawab mengelola kebijakan moneter suatu negara. Di Indonesia, bank sentralnya adalah Bank Indonesia (BI). Tugas utamanya adalah menjaga stabilitas nilai rupiah, baik terhadap barang dan jasa (inflasi) maupun terhadap mata uang asing (kurs). Bank sentral juga berperan sebagai lender of last resort, yaitu pemberi pinjaman terakhir bagi bank-bank komersial yang mengalami kesulitan likuiditas.\n\nInstrumen utama kebijakan moneter adalah suku bunga acuan. Ketika perekonomian terlalu panas dan inflasi tinggi, bank sentral akan menaikkan suku bunga untuk mengerem pertumbuhan kredit dan permintaan. Sebaliknya, ketika perekonomian lesu, bank sentral akan menurunkan suku bunga untuk mendorong pinjaman, investasi, dan konsumsi. Selain suku bunga, bank sentral juga menggunakan operasi pasar terbuka (membeli atau menjual surat berharga negara) dan giro wajib minimum (cadangan wajib bank).\n\nHubungan antara kebijakan moneter dan kehidupan sehari-hari sangat langsung. Ketika BI menaikkan suku bunga acuan, suku bunga KPR naik, cicilan kendaraan bertambah, bunga tabungan meningkat, dan biasanya nilai tukar rupiah menguat. Sebaliknya, penurunan suku bunga mendorong masyarakat untuk meminjam dan membelanjakan lebih banyak.\n\nDalam beberapa tahun terakhir, bank sentral di banyak negara juga mulai menggunakan kebijakan moneter tidak konvensional (unconventional monetary policy) seperti quantitative easing (pembelian aset besar-besaran) dan forward guidance (komunikasi tentang arah kebijakan di masa depan) untuk menghadapi situasi krisis di mana suku bunga sudah mendekati nol.',
      funFact: 'Bank Indonesia didirikan pada tanggal 1 Juli 1953, dan sejak 1999 independensinya dijamin oleh undang-undang. Sebelumnya, fungsi bank sentral di Indonesia dilakukan oleh De Javasche Bank yang didirikan oleh pemerintah Belanda pada tahun 1828.',
    },
  ],
  Pajak: [
    {
      title: 'Memahami Sistem Pajak Penghasilan (PPh) di Indonesia',
      content: 'Pajak Penghasilan (PPh) adalah pajak yang dikenakan atas penghasilan yang diterima oleh orang pribadi atau badan usaha dalam satu tahun pajak. Di Indonesia, PPh dibagi menjadi beberapa jenis berdasarkan sumber penghasilannya, seperti PPh 21 untuk penghasilan pegawai, PPh 23 untuk jasa, PPh 25 untuk pajak yang harus dibayar sendiri, dan PPh 29 untuk pelunasan.\n\nUntuk wajib pajak orang pribadi (OP), Indonesia menggunakan sistem Progressive Tax Rate atau tarif progresif. Artinya, semakin tinggi penghasilanmu, semakin tinggi persentase pajaknya. Penghasilan kena pajak (PKP) dihitung dengan mengurangkan penghasilan bruto dengan Penghasilan Tidak Kena Pajak (PTKP), biaya jabatan, iuran pensiun, dan pengurangan lainnya yang diizinkan.\n\nTarif PPh OP progresif terdiri dari beberapa lapisan. Lapisan pertama 5% untuk PKP hingga Rp60 juta, lalu 15% untuk PKP Rp60-250 juta, 25% untuk PKP Rp250-500 juta, 30% untuk PKP Rp500 juta-5 miliar, dan 35% untuk PKP di atas 5 miliar. Sistem ini memastikan bahwa wajib pajak dengan penghasilan rendah membayar proporsi pajak yang lebih kecil dibandingkan yang berpenghasilan tinggi.\n\nBatas PTKP sendiri bervariasi tergantung status pernikahan dan tanggungan. Untuk wajib pajak lajang, PTKP-nya Rp54.000.000 per tahun. Status kawin menambah Rp4.500.000, dan setiap tanggungan menambah Rp4.500.000 lagi. Jadi wajib pajak kawin dengan 3 tanggungan mendapat PTKP sebesar Rp72.000.000 per tahun.',
      funFact: 'Indonesia menggunakan NPWP (Nomor Pokok Wajib Pajak) yang terdiri dari 15 digit. Angka pertama menunjukkan jenis Wajib Pajak: 0 untuk OP, 1 untuk badan usaha, 2 untuk pemotongan pajak, dan seterusnya.',
    },
    {
      title: 'SPT Tahunan: Panduan Laporan Pajak untuk Karyawan',
      content: 'Surat Pemberitahuan (SPT) Tahunan adalah dokumen wajib yang harus disampaikan setiap wajib pajak kepada Kantor Pelayanan Pajak (KPP) paling lambat 31 Maret setiap tahunnya untuk orang pribadi, dan 30 April untuk badan usaha. SPT Tahunan merupakan bentuk pelaporan pajak yang sudah dipotong atau sudah dibayar selama satu tahun pajak.\n\nUntuk karyawan, proses pelaporan SPT Tahunan menjadi lebih mudah dengan adanya sistem e-Filing melalui website DJP Online (djponline.pajak.go.id). Karyawan cukup login menggunakan NPWP dan password, kemudian mengisi formulir elektronik SPT 1770S (untuk penghasilan satu pemberi kerja) atau SPT 1770SS (untuk penghasilan di bawah Rp60 juta per tahun dari satu pemberi kerja).\n\nLangkah-langkah pelaporan SPT Tahunan untuk karyawan dimulai dari mengumpulkan dokumen-dokumen penting seperti Formulir 1721-A1 atau 1721-A2 yang diberikan perusahaan (berisi rincian penghasilan dan PPh yang sudah dipotong), bukti potong PPh dari sumber lain jika ada, dan bukti setor PPh kurang bayar jika pernah membayar tambahan.\n\nSalah satu hal yang sering membingungkan wajib pajak adalah perbedaan antara SPT 1770, 1770S, dan 1770SS. SPT 1770 digunakan untuk wajib pajak yang memiliki penghasilan dari beberapa sumber atau memiliki usaha sendiri. SPT 1770S untuk karyawan dengan satu sumber penghasilan saja. SPT 1770SS versi paling sederhana, untuk karyawan dengan penghasilan bruto di bawah Rp60 juta setahun dari satu pemberi kerja.',
      funFact: 'Pada tahun 2024, DJP mencatat bahwa lebih dari 20 juta SPT Tahunan dilaporkan secara elektronik melalui e-Filing, meningkat drastis dari sebelumnya yang mayoritas masih menggunakan formulir kertas.',
    },
    {
      title: 'Pajak UMKM: Insentif dan Keringanan untuk Pengusaha Kecil',
      content: 'Pemerintah Indonesia memberikan berbagai insentif dan keringanan pajak bagi Usaha Mikro, Kecil, dan Menengah (UMKM) untuk mendorong pertumbuhan sektor ini. UMKM menyumbang lebih dari 60% terhadap PDB Indonesia dan menyerap lebih dari 97% tenaga kerja, menjadikannya tulang punggung perekonomian nasional.\n\nSalah satu keringanan utama adalah PPh Final UMKM dengan tarif 0,5% dari omzet bruto (Per PP 23/2018). Keringanan ini berlaku untuk UMKM yang memiliki omzet bruto di bawah Rp4,8 miliar per tahun. Dengan tarif ini, penghitungan pajak menjadi sangat sederhana — tidak perlu menghitung laba rugi, cukup kalikan omzet dengan 0,5%.\n\nSelain PPh Final, UMKM juga mendapat keringanan berupa pembebasan PPN untuk barang kena pajak tertentu yang diperdagangkan melalui sistem perdagangan elektronik. Syaratnya, omzet dalam setahun tidak melebihi Rp4,8 miliar dan UMKM harus terdaftar sebagai Pengusaha Kena Pajak (PKP) bila ingin memanfaatkan insentif ini.\n\nPemerintah juga memperluas program pembebasan pajak (tax amnesty) untuk UMKM yang belum pernah melaporkan SPT. Program ini memungkinkan UMKM untuk mendaftarkan usahanya dan melaporkan pajak tanpa dikenakan sanksi administrasi. Langkah ini diharapkan bisa meningkatkan kepatuhan pajak UMKM yang selama ini masih rendah karena berbagai hambatan seperti ketidaktahuan dan kesulitan administrasi.',
      funFact: 'Indonesia memiliki lebih dari 64 juta UMKM, namun baru sekitar 12 juta yang terdaftar sebagai wajib pajak. Pemerintah menargetkan peningkatan ini menjadi 20 juta dalam beberapa tahun ke depan.',
    },
  ],
  Investasi: [
    {
      title: 'Saham vs Obligasi: Mana yang Lebih Cocok untukmu?',
      content: 'Saham dan obligasi adalah dua instrumen investasi yang paling populer, namun memiliki karakteristik yang sangat berbeda. Saham merepresentasikan kepemilikan di perusahaan. Ketika kamu membeli saham, kamu menjadi pemilik sebagian perusahaan tersebut dan berhak atas keuntungan (dividen) serta pertumbuhan nilai saham. Namun risikonya juga tinggi — jika perusahaan bangkrut, sahammu bisa menjadi nol.\n\nObligasi, di sisi lain, adalah surat utang. Ketika kamu membeli obligasi, kamu meminjamkan uang kepada penerbit (pemerintah atau perusahaan) dan berhak atas bunga tetap (kupon) ditambah pengembalian pokok di masa depan. Risikonya lebih rendah dari saham, namun potensi keuntungannya juga lebih terbatas. Kombinasi keduanya dalam portofolio (asset allocation) adalah strategi yang umum digunakan investor untuk menyeimbangkan risiko dan return.\n\nDalam konteks Indonesia, investor bisa membeli saham melalui pasar reguler di Bursa Efek Indonesia (BEI) dengan lot minimum 100 lembar, atau melalui Reksa Dana Saham dengan modal mulai Rp10.000. Untuk obligasi, pemerintah menerbitkan Obligasi Ritel Indonesia (ORI) dan Sukuk Ritel (SR) yang bisa dibeli mulai dari Rp1.000.000 per unit.\n\nPemilihan antara saham dan obligasi sebaiknya didasarkan pada usia, tujuan investasi, dan toleransi risiko. Investor muda dengan horizon investasi panjang (10+ tahun) biasanya disarankan memiliki alokasi saham yang lebih besar (70-80%) karena punya waktu untuk pulih dari volatilitas jangka pendek. Sebaliknya, investor yang mendekati pensiun sebaiknya memiliki lebih banyak obligasi untuk menjaga stabilitas portofolio.',
      funFact: 'Saham BBCA (Bank Central Asia) adalah saham dengan kapitalisasi pasar terbesar di Indonesia, mencapai lebih dari Rp1.000 triliun. Jika kamu berinvestasi Rp10 juta di BBCA pada tahun 2000, nilainya sudah berkembang ratusan kali lipat hari ini.',
    },
    {
      title: 'Analisis Fundamental: Cara Memilih Saham yang Tepat',
      content: 'Analisis fundamental adalah metode evaluasi saham dengan mempelajari data keuangan dan kondisi bisnis perusahaan secara menyeluruh. Tujuannya adalah menentukan nilai intrinsik (intrinsic value) suatu saham dan membandingkannya dengan harga pasar. Jika harga pasar di bawah nilai intrinsik, saham tersebut dianggap undervalued (murah) dan layak dibeli.\n\nBeberapa rasio keuangan penting dalam analisis fundamental antara lain Price-to-Earnings Ratio (P/E Ratio) yang mengukur berapa kali laba per saham yang bersedia dibayar oleh investor. P/E yang rendah bisa berarti saham murah, atau bisa juga berarti pasar pesimistis terhadap prospek perusahaan. Rasio lainnya adalah Price-to-Book Value (PBV) yang membandingkan harga saham dengan nilai buku per sahamnya.\n\nSelain rasio-rasio tersebut, investor fundamental juga memperhatikan kualitas manajemen, posisi kompetitif perusahaan (moat), pertumbuhan pendapatan dan laba secara konsisten, tingkat hutang (debt-to-equity ratio), dan arus kas operasional. Warren Buffett, salah satu investor terhebat sepanjang masa, sangat menekankan pentingnya "economic moat" — keunggulan kompetitif yang memungkinkan perusahaan mempertahankan profitabilitasnya dalam jangka panjang.\n\nAnalisis fundamental berbeda dengan analisis teknikal. Jika fundamental melihat ke dalam (kondisi perusahaan), teknikal melihat ke luar (pergerakan harga dan volume di chart). Keduanya memiliki kelebihan masing-masing, dan banyak investor profesional menggunakan kombinasi keduanya untuk mengambil keputusan investasi yang lebih komprehensif.',
      funFact: 'Peter Lynch, manajer investasi legendaris Fidelity Magellan Fund, berhasil menghasilkan return rata-rata 29,2% per tahun selama 13 tahun (1977-1990). Rahasianya? "Invest in what you know" — investasi di perusahaan yang produknya kamu gunakan dan pahami.',
    },
    {
      title: 'Reksa Dana: Investasi Mudah untuk Pemula',
      content: 'Reksa dana adalah wadah yang menghimpun dana dari berbagai investor kemudian dikelola secara profesional oleh manajer investasi. Konsepnya sederhana: kamu menyerahkan uangmu kepada para ahli, dan mereka akan memutuskan di mana menginvestasikannya. Ini membuat reksa dana menjadi pilihan ideal bagi pemula yang belum memiliki waktu atau pengetahuan untuk mengelola investasi sendiri.\n\nReksa dana di Indonesia dibagi menjadi empat jenis utama. Reksa dana pasar uang yang berinvestasi di instrumen hutang jangka pendek (risiko sangat rendah, return sekitar 3-5% per tahun). Reksa dana pendapatan tetap yang berinvestasi di obligasi (risiko rendah-sedang, return 5-7%). Reksa dana saham yang berinvestasi di saham (risiko tinggi, return potensial 8-15%). Dan reksa dana campuran yang mengkombinasikan ketiganya sesuai proporsi tertentu.\n\nKeunggulan utama reksa dana adalah diversifikasi otomatis dengan modal kecil. Dengan Rp10.000 saja, kamu sudah bisa memiliki portofolio yang tersebar di puluhan saham atau obligasi. Ini mustahil dilakukan jika kamu membeli saham langsung yang butuh minimal Rp100.000 (100 lembar x harga saham). Manajer investasi juga melakukan riset dan pengawasan portofolio secara profesional.\n\nCara membeli reksa dana sangat mudah. Bisa melalui aplikasi marketplace reksa dana seperti Bibit, Ajaib, atau bareksa, maupun melalui bank dan sekuritas. Yang perlu diperhatikan adalah biaya administrasi (biasanya 0,1-0,2% per tahun), biaya pembelian (0-2%), dan biaya penjualan (0-1%). Pastikan untuk memilih reksa dana yang sesuai dengan profil risikomu.',
      funFact: 'Industri reksa dana Indonesia tumbuh sangat pesat — dari kurang dari 100 produk reksa dana pada tahun 2010 menjadi lebih dari 1.800 produk pada tahun 2024 dengan total dana kelolaan (AUM) mencapai Rp600 triliun.',
    },
  ],
  Manajemen: [
    {
      title: 'Prinsip Manajemen Modern: Dari Taylor hingga Agile',
      content: 'Manajemen modern telah berevolusi dari pendekatan yang sangat mekanis menjadi lebih humanis dan adaptif. Frederick Taylor mempelopori Scientific Management pada akhir 1800-an, yang berfokus pada efisiensi melalui pengukuran dan standarisasi. Kemudian, Elton Mayo membuktikan melalui eksperimen Hawthorne bahwa faktor sosial dan psikologis pekerja sama pentingnya dengan efisiensi fisik.\n\nDi era digital, metodologi Agile telah mengubah cara tim bekerja. Alih-alih perencanaan bertahap yang kaku (waterfall), Agile mengedepankan iterasi cepat, kolaborasi lintas fungsi, dan responsivitas terhadap perubahan. Prinsip-prinsip ini tidak hanya digunakan di industri teknologi, tetapi sudah diadopsi oleh berbagai sektor mulai dari perbankan hingga kesehatan.\n\nManajemen modern juga menekankan pentingnya emotional intelligence (kecerdasan emosional) bagi seorang pemimpin. Daniel Goleman dalam bukunya "Emotional Intelligence" menunjukkan bahwa EQ seringkali lebih menentukan keberhasilan seorang pemimpin dibandingkan IQ. Pemimpin yang mampu mengelola emosinya sendiri dan empati terhadap timnya cenderung menciptakan lingkungan kerja yang lebih produktif.\n\nKonsep lain yang semakin populer adalah servant leadership (kepemimpinan pelayan) yang dipopulerkan oleh Robert Greenleaf. Dalam model ini, pemimpin bukan figur yang memerintah dari atas, melainkan yang melayani timnya dengan memastikan setiap anggota memiliki sumber daya dan dukungan yang dibutuhkan untuk berkembang. Pendekatan ini terbukti meningkatkan engagement dan retensi karyawan secara signifikan.',
      funFact: 'Toyota Production System (TPS) yang dikembangkan oleh Taiichi Ohno di tahun 1950-an menjadi inspirasi utama metodologi Lean dan Agile yang digunakan oleh perusahaan teknologi dunia saat ini, termasuk Spotify dan Netflix.',
    },
    {
      title: 'OKR vs KPI: Framework Pengukuran Kinerja yang Efektif',
      content: 'OKR (Objectives and Key Results) dan KPI (Key Performance Indicators) adalah dua framework pengukuran kinerja yang sering membingungkan karena terlihat mirip. Namun keduanya memiliki perbedaan fundamental dalam pendekatan dan tujuannya. Memahami perbedaan ini sangat penting bagi setiap manajer yang ingin mengelola tim secara efektif.\n\nOKR diperkenalkan oleh Andy Grove di Intel dan dipopulerkan oleh John Doerr di Google. Framework ini terdiri dari Objective (tujuan aspirasional yang memotivasi) dan Key Results (hasil terukur yang menunjukkan kemajuan menuju tujuan). OKR bersifat ambisius — idealnya, penyelesaian 70% sudah dianggap sukses. OKR biasanya ditetapkan per kuartal dan bersifat transparan di seluruh organisasi.\n\nKPI, di sisi lain, lebih bersifat operasional dan stabil. KPI mengukur kinerja ongoing dari proses bisnis yang sudah mapan. Contohnya: tingkat produksi per jam, tingkat customer satisfaction, atau conversion rate website. KPI biasanya ditetapkan untuk jangka waktu yang lebih panjang dan jarang berubah dibandingkan OKR.\n\nPerbedaan kunci lainnya: KPI biasanya bersifat "top-down" (ditetapkan oleh manajemen), sementara OKR mendorong partisipasi bawah ke atas (bottom-up). OKR juga mendorong kolaborasi lintas tim karena OKR bersifat transparan — setiap orang bisa melihat OKR tim lain. Banyak perusahaan seperti Google, LinkedIn, dan Twitter menggunakan OKR, sementara KPI lebih umum di industri manufaktur dan perbankan tradisional.',
      funFact: 'Google menggunakan OKR sejak tahun 1999 ketika perusahaan masih berusia 1 tahun. John Doerr memperkenalkan konsep ini dalam presentasi 90 menit yang legendaris, dan sejak itu OKR menjadi bagian dari DNA perusahaan.',
    },
    {
      title: 'Manajemen Waktu: Teknik Pomodoro dan Lainnya untuk Produktivitas',
      content: 'Manajemen waktu adalah keterampilan yang semakin krusial di era digital yang penuh distraksi. Salah satu teknik paling populer adalah Pomodoro Technique yang dikembangkan oleh Francesco Cirillo pada akhir 1980-an. Teknik ini membagi waktu kerja menjadi interval 25 menit (disebut "pomodoro") diikuti istirahat pendek 5 menit. Setelah 4 pomodoro, ambil istirahat panjang 15-30 menit.\n\nRahasia Pomodoro bukan pada angka 25 menitnya, melainkan pada prinsip-prinsip di baliknya: fokus pada satu tugas saja, memecah tugas besar menjadi potongan-potongan kecil yang ter manageable, dan menggunakan timer sebagai komitmen psikologis. Ketika timer berbunyi, kamu harus berhenti — bahkan jika sedang "on fire." Ini mencegah burnout dan menjaga kualitas fokus tetap tinggi sepanjang hari.\n\nSelain Pomodoro, ada beberapa teknik manajemen waktu lain yang efektif. Eisenhower Matrix mengklasifikasikan tugas ke dalam 4 kuadran berdasarkan urgensi dan pentingnya. Time blocking mengalokasikan slot waktu spesifik untuk kategori tugas tertentu. Two-minute rule dari David Allen menyatakan bahwa jika suatu tugas bisa diselesaikan dalam 2 menit, lakukanlah segera jangan ditunda.\n\nSalah satu kesalahan terbesar dalam manajemen waktu adalah multitasking. Riset menunjukkan bahwa manusia sebenarnya tidak bisa melakukan multitasking — yang terjadi adalah task-switching yang menghabiskan energi kognitif dan mengurangi kualitas kerja. Sebuah studi dari University of California menemukan bahwa setelah terganggu, rata-rata butuh 23 menit untuk kembali ke tingkat fokus yang sama.',
      funFact: 'Francesco Cirillo menamai teknik ini "Pomodoro" (tomato dalam bahasa Italia) karena timer dapur berbentuk tomat yang ia gunakan saat mahasiswa. Timer tomat merah itu kini menjadi ikon manajemen waktu yang dikenal di seluruh dunia.',
    },
  ],
};

const DEFAULT_FALLBACK = {
  title: 'Pentingnya Literasi Keuangan di Era Digital',
  content: 'Literasi keuangan adalah kemampuan untuk memahami dan menggunakan berbagai konsep keuangan secara efektif, termasuk mengelola keuangan pribadi, memahami investasi, dan membuat keputusan finansial yang bijak. Menurut survei OJK, tingkat literasi keuangan di Indonesia masih relatif rendah dibandingkan negara-negara ASEAN lainnya. Hal ini menjadi perhatian serius mengingat semakin kompleksnya produk keuangan di era digital.\n\nMemahami konsep dasar seperti budgeting, saving, compound interest, dan diversifikasi risiko sangat penting untuk mencapai kesejahteraan finansial jangka panjang. Banyak orang yang berpenghasilan tinggi tetapi tidak mampu menabung karena kurangnya perencanaan keuangan. Sebaliknya, orang yang melek keuangan mampu memaksimalkan penghasilannya melalui perencanaan yang tepat.\n\nDi era digital, tantangan literasi keuangan semakin meningkat. Munculnya fintech, investasi online, dan produk keuangan digital memerlukan pemahaman yang lebih baik dari konsumen. Sayangnya, kemudahan akses seringkali tidak diimbangi dengan pemahaman yang memadai, menyebabkan banyak orang terjebak dalam produk keuangan berisiko tinggi tanpa menyadarinya.',
  funFact: 'Menurut laporan Global Financial Literacy Survey, hanya sekitar 38% populasi dewasa di Indonesia yang memahami konsep keuangan dasar seperti bunga majemuk dan inflasi.',
};

// ── LLM Summarization ────────────────────────────────────────────────────────

async function summarizeArticle(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  pageTitle: string,
  pageText: string,
  topic: string,
): Promise<{ title: string; content: string; funFact: string }> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah asisten pembelajaran keuangan dan ekonomi. Tugasmu adalah membuat ringkasan artikel edukatif dalam bahasa Indonesia.

FORMAT OUTPUT (WAJIB JSON valid, tanpa markdown code block):
{
  "title": "Judul artikel yang menarik dan informatif",
  "content": "Ringkasan artikel 500-700 kata dalam bahasa Indonesia. Tulis dalam 5-7 paragraf yang mengalir secara naratif. Jelas, detail, dan mudah dipahami. Berikan contoh konkret dan penjelasan mendalam. JANGAN gunakan format list/bullet/numbering. Gunakan paragraf naratif yang padat dan informatif. Setiap paragraf harus memiliki substansi yang kuat.",
  "funFact": "Satu fakta menarik terkait topik dalam 1-2 kalimat. Bisa berupa data statistik mengejutkan, sejarah yang jarang diketahui, atau trivia yang menginspirasi."
}

PENTING:
- Konten harus PANJANG dan DETAIL, minimal 500 kata
- Jangan ulang-ulang poin yang sama
- Berikan kedalaman penjelasan, bukan sekadar permukaan
- Gunakan transisi yang natural antar paragraf
- Output HANYA JSON valid, tanpa teks tambahan apapun sebelum atau sesudah.`,
        },
        {
          role: 'user',
          content: `Buatkan ringkasan edukatif yang detail dan panjang tentang topik "${topic}" berdasarkan konten berikut:

Judul: ${pageTitle}
Konten: ${pageText.substring(0, 8000)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
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

// ── Main GET handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || '';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const todayKey = getTodayKey();

    if (!topic) {
      return NextResponse.json({ ...DEFAULT_FALLBACK, topic: '', source: 'fallback', date: todayKey });
    }

    const cacheKey = `${todayKey}|${topic}`;

    // Return cache only if NOT forced refresh
    if (!forceRefresh) {
      const cached = articleCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const seen = getSeenTitles(topic);
    let article = { title: '', content: '', funFact: '' };
    let source = 'fallback';

    // Try to fetch from internet
    const zai = await ZAI.create();
    const queries = getSearchQueries(topic);

    try {
      // Step 1: Web search with random query from our diverse list
      const shuffled = [...queries].sort(() => Math.random() - 0.5);
      const randomQuery = shuffled[0];

      const searchResults = await zai.functions.invoke('web_search', {
        query: randomQuery,
        num: 10,
      });

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        // Filter: exclude PDFs/downloads, must have URL and decent snippet, exclude seen titles
        const goodResults = (searchResults as Array<{ url?: string; name?: string; snippet?: string }>)
          .filter(r => r.url && !r.url.toLowerCase().endsWith('.pdf') && !r.url.includes('/download/'))
          .filter(r => r.snippet && r.snippet.length > 50)
          .filter(r => !seen.includes(r.name || ''));

        if (goodResults.length > 0) {
          // Try up to 3 different pages to find one that works
          const tryResults = goodResults.slice(0, Math.min(3, goodResults.length));

          for (const selected of tryResults) {
            try {
              // Step 2: Read the page
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
                if (result.title && result.content) {
                  article = result;
                  break; // Success — stop trying other pages
                }
              }
            } catch {
              // This page failed, try next one
              continue;
            }
          }

          // If all page readers failed, use LLM with snippets directly
          if (!article.title || !article.content) {
            const allSnippets = goodResults
              .slice(0, 5)
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

    // Use fallback if web fetch didn't produce a good article
    if (!article.title || !article.content) {
      const fallbacks = FALLBACK_ARTICLES[topic] || [];
      if (fallbacks.length > 0) {
        // Pick a fallback not in seen list
        const unseen = fallbacks.filter(f => !seen.includes(f.title));
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

    // Track this title as seen
    addSeenTitle(topic, article.title);

    const result: ArticleData = {
      title: article.title,
      content: article.content,
      funFact: article.funFact,
      topic,
      source,
      date: todayKey,
    };

    // Update cache
    articleCache.set(cacheKey, result);

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