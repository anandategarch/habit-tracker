import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { jakartaDateString } from '@/lib/timezone';

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

// Cache: keyed by "date|topic" → first article of the day (no refresh)
const articleCache = new Map<string, ArticleData>();

// Track article titles we've already shown today (per topic)
const shownTodayTitles = new Map<string, Set<string>>();

// Global refresh counter per topic for unique cache keys
const refreshCounter = new Map<string, number>();

function getTodayKey(): string {
  return jakartaDateString();
}

function addShownTitle(topic: string, title: string) {
  const todayKey = getTodayKey();
  const mapKey = `${todayKey}|${topic}`;
  const set = shownTodayTitles.get(mapKey) || new Set<string>();
  set.add(title);
  shownTodayTitles.set(mapKey, set);
}

function getShownTitles(topic: string): Set<string> {
  const todayKey = getTodayKey();
  const mapKey = `${todayKey}|${topic}`;
  return shownTodayTitles.get(mapKey) || new Set<string>();
}

function getNextRefreshId(topic: string): number {
  const current = refreshCounter.get(topic) || 0;
  const next = current + 1;
  refreshCounter.set(topic, next);
  return next;
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
    'akuntansi manajemen vs keuangan perbedaan',
    'audit internal perusahaan prosedur',
    'akuntansi forensic fraud detection',
    'depresiasi amortisasi penjelasan lengkap',
    'accrual basis vs cash basis akuntansi',
    'working capital management akuntansi',
    'akuntansi perpajakan dasar Indonesia',
    'cash flow statement analisis',
    'reconciliation bank rekonsiliasi bank',
    'budgeting perusahaan teknik penyusunan',
    'akuntansi sektor publik pemerintahan',
    'activity based costing contoh',
  ],
  Keuangan: [
    'manajemen keuangan pribadi strategi',
    'cara membuat anggaran bulanan efektif',
    'investasi reksa dana pemula panduan',
    'bunga majemuk perhitungan contoh',
    'literasi keuangan Indonesia OJK',
    'dana darurat berapa jumlah ideal',
    'pinjaman online legal vs ilegal',
    'kredit skor Indonesia pengertian',
    'financial planning pernikahan indonesia',
    'keuangan syariah produk perbankan',
    'diversifikasi portofolio investasi',
    'inflasi dampak terhadap keuangan',
    'asuransi jiwa kesehatan perbedaan',
    'cicilan KPR tips memilih',
    'tabungan vs deposito vs reksadana',
    ' fintech indonesia perkembangan 2024',
    'perencanaan pajak keuangan personal',
    'emergency fund strategi membangun',
  ],
  Ekonomi: [
    'pengertian GDP PNB Indonesia terbaru',
    'inflasi Indonesia penyebab dan dampak',
    'supply dan demand contoh nyata',
    'ekonomi makro vs mikro perbedaan',
    'kebijakan moneter Bank Indonesia',
    'fiscal policy pemerintah indonesia',
    'ekonomi digital indonesia pertumbuhan',
    'UEU usaha mikro kecil menengah',
    'kurva Phillips inflasi pengangguran',
    'ekonomi kreatif indonesia potensi',
    'foreign direct investment FDI indonesia',
    'negara maju vs berkembang ciri',
    'ekonomi pasar bebas vs terencana',
    'harga minyak dampak ekonomi global',
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
    'crypto bitcoin ethereum regulasi indonesia',
    'dollar cost averaging DCA strategi',
    'smart beta investing strategi',
  ],
  Manajemen: [
    'prinsip manajemen henry fayol',
    'leadership styles gaya kepemimpinan',
    'manajemen proyek agile scrum',
    'strategic planning proses perencanaan',
    'manajemen SDM sumber daya manusia',
    'marketing mix 7P strategi pemasaran',
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
    '{topic} tren global 2024',
    '{topic} risiko dan peluang',
    'mahasiswa belajar {topic} panduan',
  ],
};

function getSearchQueries(topic: string): string[] {
  const specific = TOPIC_QUERIES[topic];
  if (specific) return specific;
  return TOPIC_QUERIES.default.map(q => q.replace('{topic}', topic));
}

// ── Fallback articles (5 per topic, each 500-700 words) ─────────────────────

const FALLBACK_ARTICLES: Record<string, { title: string; content: string; funFact: string }[]> = {
  Akuntansi: [
    {
      title: 'Mengenal Double-Entry Bookkeeping: Fondasi Akuntansi Modern',
      content: 'Double-entry bookkeeping adalah sistem pencatatan akuntansi di mana setiap transaksi dicatat dalam dua akun berbeda: sisi debit dan sisi kredit. Prinsip dasarnya adalah "setiap debit memiliki kredit yang setara." Misalnya, ketika perusahaan membeli perlengkapan seharga Rp1.000.000 secara tunai, maka akun Perlengkapan akan didebit (bertambah) dan akun Kas akan dikredit (berkurang) dengan jumlah yang sama. Sistem ini memastikan bahwa setiap transaksi tercatat secara lengkap dan akurat, sehingga laporan keuangan yang dihasilkan dapat dipercaya oleh pemangku kepentingan.\n\nSistem ini pertama kali didokumentasikan oleh Luca Pacioli pada tahun 1494 dalam bukunya "Summa de Arithmetica." Hingga kini, double-entry bookkeeping menjadi fondasi dari seluruh sistem akuntansi modern di dunia. Tanpa sistem ini, perusahaan tidak akan bisa menyusun laporan keuangan yang akurat seperti neraca, laporan laba rugi, dan arus kas. Pacioli sendiri tidak menciptakan sistem ini, melainkan merangkum praktik yang sudah digunakan oleh pedagang Italia selama berabad-abad.\n\nDalam praktiknya, setiap transaksi akan mempengaruhi setidaknya dua akun. Misalnya, ketika perusahaan menjual barang secara kredit, akun Piutang Usaha akan didebit (aset bertambah) dan akun Pendapatan Penjualan akan dikredit (pendapatan bertambah). Jika barang tersebut memiliki harga pokok, maka akun Harga Pokok Penjualan akan didebit (beban bertambah) dan akun Persediaan Barang Dagang akan dikredit (aset berkurang). Dengan demikian, dampak suatu transaksi terhadap posisi keuangan perusahaan dapat dilacak dengan jelas.\n\nKeunggulan utama dari sistem ini adalah kemampuannya untuk mendeteksi kesalahan. Karena total debit harus selalu sama dengan total kredit, setiap ketidakseimbangan menandakan adanya kesalahan pencatatan yang perlu dilacak. Ini memberikan mekanisme kontrol internal yang sangat berharga bagi bisnis, terutama perusahaan besar dengan ribuan transaksi harian. Akuntan modern menggunakan software seperti SAP, Oracle, atau Accurate untuk mengotomatisasi proses ini, namun prinsip dasarnya tetap sama sejak abad ke-15.\n\nDi era digital saat ini, konsep double-entry mengalami evolusi dengan adanya teknologi blockchain dan distributed ledger. Beberapa startup bahkan mengembangkan sistem akuntansi berbasis blockchain yang secara otomatis mencatat setiap transaksi secara immutable. Meskipun belum banyak diadopsi oleh perusahaan besar, konsep ini menunjukkan bahwa prinsip pencatatan ganda Pacioli tetap relevan dan terus berkembang mengikuti zamannya.',
      funFact: 'Sistem pembukuan ganda (double-entry) pertama kali digunakan secara luas oleh pedagang di Venice, Italia pada abad ke-13, jauh sebelum Luca Pacioli menuliskannya secara formal.',
    },
    {
      title: 'Apa Itu Laporan Arus Kas dan Mengapa Sangat Penting?',
      content: 'Laporan arus kas (cash flow statement) adalah salah satu dari tiga laporan keuangan utama yang wajib disusun perusahaan. Laporan ini mencatat semua penerimaan dan pengeluaran kas dalam periode tertentu, dikelompokkan menjadi tiga aktivitas: operasional, investasi, dan pembiayaan. Memahami laporan ini sangat penting karena kas adalah "nyawa" bagi setiap bisnis — tanpa kas yang memadai, bahkan perusahaan yang sangat menguntungkan pun bisa bangkrut.\n\nAktivitas operasional mencakup kas dari kegiatan bisnis inti, seperti penerimaan dari pelanggan dan pembayaran kepada pemasok. Ini adalah indikator paling penting karena menunjukkan apakah bisnis inti perusahaan benar-benar menghasilkan kas. Aktivitas investasi terkait pembelian dan penjualan aset jangka panjang seperti tanah, bangunan, dan peralatan. Pengeluaran investasi yang besar menandakan perusahaan sedang berkembang, namun jika terlalu agresif bisa menguras likuiditas.\n\nAktivitas pembiayaan melibatkan transaksi dengan pemilik dan kreditur, seperti penerbitan saham, pembayaran dividen, dan pinjaman bank. Perusahaan yang banyak mengandalkan utang untuk membiayai operasinya akan menunjukkan arus kas pembiayaan yang positif di awal, namun harus membayar kembali di masa depan. Analis keuangan memperhatikan rasio arus kas operasional terhadap utang untuk menilai kemampuan bayar perusahaan.\n\nBanyak perusahaan yang tampak menguntungkan di laporan laba rugi justru mengalami kebangkrutan karena arus kasnya negatif. Fenomena ini dikenal sebagai "profitable but cash poor." Sebagai contoh, perusahaan bisa melaporkan laba bersih yang tinggi karena penjualan kreditnya besar, namun jika pelanggan tidak membayar tepat waktu, kas di rekening perusahaan bisa kosong. WorldCom dan Enron adalah contoh tragis perusahaan yang melaporkan laba besar namun ternyata manipulasi arus kasnya.\n\nAnalisis arus kas juga membantu investor menilai kualitas laba perusahaan. Laba yang didukung oleh arus kas operasional yang kuat dianggap lebih berkualitas dibandingkan laba yang berasal dari transaksi non-kas. Oleh karena itu, para analis keuangan selalu membandingkan laba bersih dengan arus kas operasional sebagai salah satu indikator kesehatan keuangan perusahaan. Free cash flow — yaitu arus kas operasional dikurangi capital expenditure — menjadi metrik favorit karena menunjukkan berapa banyak kas "bebas" yang bisa digunakan untuk dividen, pembayaran utang, atau akuisisi.',
      funFact: 'Krisis keuangan Asia 1997 menunjukkan bahwa banyak perusahaan besar yang "untung di atas kertas" namun bangkrut karena tidak memiliki cukup kas untuk membayar hutang jangka pendeknya.',
    },
    {
      title: 'Memahami Prinsip Matching dalam Akuntansi Akrual',
      content: 'Prinsip matching (prinsip penandingan) adalah salah satu prinsip paling fundamental dalam akuntansi akrual. Prinsip ini menyatakan bahwa pendapatan harus diakui pada periode yang sama dengan beban yang dikeluarkan untuk menghasilkan pendapatan tersebut. Dengan kata lain, upaya (biaya) harus dicocokkan dengan hasil (pendapatan) dalam periode yang sama. Prinsip ini memastikan bahwa laporan laba rugi mencerminkan kinerja ekonomi suatu periode secara akurat, bukan sekadar mencatat arus kas masuk dan keluar.\n\nSebagai contoh, jika sebuah toko membeli barang dagangan seharga Rp50.000.000 pada bulan Januari namun baru menjualnya pada bulan Maret, maka biaya pembelian barang tersebut tidak langsung diakui sebagai beban di Januari. Sebaliknya, biaya tersebut baru diakui sebagai Harga Pokok Penjualan (HPP) pada bulan Maret ketika pendapatan penjualannya diakui. Dengan demikian, laba bulan Maret mencerminkan upaya nyata yang dikeluarkan untuk menghasilkan pendapatan tersebut.\n\nPrinsip ini berbeda dengan akuntansi kas (cash basis) di mana pendapatan dan beban baru diakui ketika kas benar-benar diterima atau dikeluarkan. Dalam akuntansi akrual, prinsip matching memastikan bahwa laporan laba rugi memberikan gambaran yang lebih akurat tentang profitabilitas perusahaan. Tanpa prinsip ini, perusahaan bisa memanipulasi laba dengan hanya mempercepat atau menunda pembayaran.\n\nPenerapan prinsip matching juga melibatkan konsep akrual dan deferral yang lebih luas. Akrual adalah pengakuan pendapatan atau beban sebelum kas diterima atau dikeluarkan, seperti piutang dan beban yang masih harus dibayar. Deferral adalah penundaan pengakuan pendapatan atau beban yang sudah diterima atau dibayar dalam bentuk kas. Contoh deferral adalah pendapatan diterima di muka (unearned revenue) yang baru diakui sebagai pendapatan setelah layanan diberikan.\n\nPrinsip matching memiliki implikasi penting dalam praktik akuntansi modern. Misalnya, dalam pencatatan depresiasi aset tetap, biaya pembelian mesin yang bisa digunakan selama 10 tahun tidak langsung dibebankan sekaligus, melainkan dialokasikan sebagai beban depresiasi selama masa manfaatnya. Hal ini memastikan bahwa beban pencocokan sebanding dengan manfaat ekonomi yang diperoleh dari penggunaan aset tersebut di setiap periode. PSAK (Pernyataan Standar Akuntansi Keuangan) Indonesia secara eksplisit mengadopsi prinsip ini sebagai landasan penyusunan laporan keuangan.',
      funFact: 'Prinsip matching pertama kali diperkenalkan oleh American Institute of Accountants (sekarang AICPA) pada tahun 1930-an dan menjadi dasar GAAP (Generally Accepted Accounting Principles) yang digunakan hingga saat ini.',
    },
    {
      title: 'PSAK 73: Standar Penyajian Laporan Keuangan yang Wajib Dipahami',
      content: 'PSAK 73 merupakan standar akuntansi Indonesia yang mengadopsi IFRS Conceptual Framework dan menggantikan PSAK 1 sebagai pedoman penyusunan laporan keuangan. Standar ini memberikan panduan komprehensif tentang tujuan, karakteristik kualitatif, elemen, pengukuran, dan penyajian laporan keuangan. Bagi setiap akuntan dan profesional keuangan di Indonesia, memahami PSAK 73 adalah keharusan mutlak karena menjadi kerangka dasar seluruh standar akuntansi lainnya.\n\nTujuan utama laporan keuangan menurut PSAK 73 adalah menyediakan informasi keuangan yang berguna bagi para pengguna dalam pengambilan keputusan ekonomi. Informasi ini harus membantu pengguna menilai posisi keuangan entitas, kinerja keuangan, dan arus kas entitas. Pengguna utama laporan keuangan meliputi investor, kreditor, pemberi pinjaman, dan pihak lain yang membutuhkan informasi untuk membuat keputusan tentang memberikan sumber daya kepada entitas.\n\nKarakteristik kualitatif yang diharuskan oleh PSAK 73 dibagi menjadi dua kategori. Karakteristik kualitatif fundamental meliputi relevansi dan representasi kesetiaan (faithful representation). Relevansi berarti informasi harus mampu membuat perbedaan dalam keputusan pengguna, memiliki nilai prediktif dan nilai konfirmasi. Representasi kesetiaan berarti informasi harus lengkap, netral, dan bebas dari kesalahan. Selain itu, ada karakteristik peningkat yaitu dapat dibandingkan, dapat diverifikasi, tepat waktu, dan dapat dipahami.\n\nElemen laporan keuangan menurut PSAK 73 meliputi aset, liabilitas, ekuitas, pendapatan, dan beban. Masing-masing elemen memiliki definisi yang ketat dan kriteria pengakuan yang harus dipenuhi sebelum dapat dicatat dalam laporan keuangan. Misalnya, aset didefinisikan sebagai sumber daya yang dikendalikan entitas sebagai akibat dari peristiwa masa lalu dan dari mana manfaat ekonomi masa depan diharapkan akan diperoleh entitas. Definisi ini menekankan konsep kontrol dan ekspektasi manfaat ekonomi.\n\nPengukuran basis dalam PSAK 73 menyediakan berbagai alternatif termasuk biaya historis, biaya saat ini (current cost), realisasi/settlement value, dan nilai sekarang (present value). Penerapan standar ini telah meningkatkan kualitas pelaporan keuangan di Indonesia secara signifikan, memudahkan perusahaan Indonesia yang beroperasi di pasar global, dan meningkatkan transparansi bagi investor asing yang ingin menanamkan modal di Indonesia.',
      funFact: 'Indonesia menjadi salah satu negara pertama di ASEAN yang secara penuh mengadopsi IFRS melalui konvergensi PSAK-IFRS, sebuah proses yang dimulai sejak 2008 dan terus diperbarui hingga saat ini.',
    },
    {
      title: 'Audit Internal vs Eksternal: Perbedaan, Tujuan, dan Implementasi',
      content: 'Audit internal dan audit eksternal adalah dua fungsi pengawasan yang berbeda namun saling melengkapi dalam tata kelola perusahaan. Memahami perbedaan mendasar antara keduanya sangat penting bagi manajemen perusahaan, pemegang saham, dan pihak berkepentingan lainnya karena masing-masing memiliki peran, ruang lingkup, dan tujuan yang berbeda dalam menjaga integritas laporan keuangan dan operasional perusahaan.\n\nAudit internal dilakukan oleh tim yang merupakan karyawan perusahaan sendiri, biasanya berada di bawah departemen audit internal yang melapor langsung ke komisaris atau komite audit. Fungsi utamanya adalah mengevaluasi efektivitas pengendalian internal, manajemen risiko, dan tata kelola perusahaan. Auditor internal bekerja sepanjang tahun dan memberikan rekomendasi perbaikan secara berkelanjutan. Mereka juga melakukan reviu terhadap proses bisnis, efisiensi operasional, dan kepatuhan terhadap kebijakan perusahaan.\n\nSebaliknya, audit eksternal dilakukan oleh auditor independen dari KAP (Kantor Akuntan Publik) yang terdaftar di OJK. Tujuan utama audit eksternal adalah memberikan opini atas kewajaran laporan keuangan perusahaan berdasarkan standar audit yang berlaku. Auditor eksternal bekerja berdasarkan engagement yang diperjanjikan dan umumnya melakukan pekerjaan mereka pada akhir periode pelaporan. Hasil kerja mereka berupa opini audit yang dipublikasikan bersama laporan keuangan tahunan perusahaan.\n\nMeskipun berbeda, kedua jenis audit ini memiliki area tumpang tindih yang penting. Auditor eksternal seringkali memanfaatkan hasil kerja auditor internal sebagai dasar untuk menentukan luasnya pengujian yang akan dilakukan. Jika fungsi audit internal perusahaan dianggap efektif, auditor eksternal dapat mengurangi luas pengujian substantif mereka. Sebaliknya, jika audit internal lemah, auditor eksternal harus melakukan pengujian yang lebih ekstensif.\n\nDalam praktik modern, baik audit internal maupun eksternal semakin mengadopsi teknologi data analytics untuk meningkatkan efektivitas dan efisiensi pemeriksaan. Penggunaan alat bantu seperti ACL, IDEA, atau Python untuk menganalisis data transaksi dalam jumlah besar memungkinkan auditor menemukan anomali yang sulit terdeteksi melalui pengujian sampel konvensional. Trend ini semakin diperkuat dengan adanya regulasi yang mendorong transformasi digital di sektor jasa keuangan.',
      funFact: 'Profesi audit independen modern lahir dari skandal keuangan bersejarah — kejatuhan South Sea Company di Inggris tahun 1720 yang mendorong perlunya pemeriksaan independen atas laporan keuangan perusahaan.',
    },
  ],
  Keuangan: [
    {
      title: 'Konsep Bunga Majemuk: Keajaiban Waktu dalam Investasi',
      content: 'Bunga majemuk (compound interest) sering disebut oleh Albert Einstein sebagai "keajaiban kedelapan dunia" dan merupakan konsep paling fundamental dalam dunia keuangan. Berbeda dengan bunga sederhana yang hanya dihitung dari modal awal, bunga majemuk dihitung dari modal awal ditambah bunga yang telah terakumulasi sebelumnya. Artinya, bunga yang Anda peroleh akan menghasilkan bunga lagi di periode berikutnya, menciptakan efek bola salju yang semakin besar seiring waktu.\n\nSebagai contoh ilustratif, jika Anda menginvestasikan Rp10.000.000 dengan bunga majemuk 10% per tahun, maka di akhir tahun pertama Anda akan memiliki Rp11.000.000. Di tahun kedua, bunga 10% dihitung bukan dari Rp10.000.000, melainkan dari Rp11.000.000, sehingga total menjadi Rp12.100.000. Di tahun ke-10, investasi Anda akan bertumbuh menjadi sekitar Rp25.937.000 tanpa menambah setoran sedikitpun. Jika Anda menunggu 20 tahun, jumlahnya melonjak menjadi Rp67.275.000. Efek ini semakin dramatis pada periode yang lebih panjang.\n\nRumus bunga majemuk adalah A = P(1 + r/n)^(nt), di mana A adalah jumlah akhir, P adalah modal awal, r adalah tingkat bunga tahunan, n adalah frekuensi penggabungan bunga per tahun, dan t adalah jumlah tahun. Frekuensi penggabungan bunga juga berpengaruh signifikan. Bunga yang dikompounds bulanan menghasilkan return lebih tinggi dibandingkan tahunan, karena setiap bulan ada bunga baru yang ditambahkan ke modal.\n\nDalam konteks Indonesia, konsep ini sangat relevan untuk produk-produk seperti deposito berjangka, reksa dana, dan asuransi dwiguna. Bank-bank di Indonesia umumnya menawarkan bunga deposito dengan perhitungan majemuk bulanan, yang secara efektif memberikan return sedikit lebih tinggi dari rate nominal yang dikutip. Namun, investor perlu memperhatikan bahwa bunga deposito di atas Rp7,5 juta dikenakan pajak 20% sesuai regulasi Ditjen Pajak.\n\nKunci utama memaksimalkan bunga majemuk adalah memulai sedini mungkin dan konsisten. Seseorang yang mulai berinvestasi Rp500.000 per bulan sejak usia 25 tahun dengan return rata-rata 8% per tahun akan memiliki akumulasi yang jauh lebih besar dibandingkan orang yang mulai Rp1.000.000 per bulan sejak usia 35 tahun, meskipun total kontribusi orang pertama lebih kecil. Ini menunjukkan bahwa waktu, bukan jumlah uang, adalah faktor terpenting dalam memanfaatkan bunga majemuk.',
      funFact: 'Jika Benjamin Franklin meninggalkan £1.000 pada tahun 1790 dengan bunga majemuk 5%, pada tahun 1990 dana tersebut akan bertumbuh menjadi lebih dari £3,5 juta — inilah kekuatan compound interest selama 200 tahun.',
    },
    {
      title: 'Strategi Membangun Dana Darurat yang Tepat',
      content: 'Dana darurat (emergency fund) adalah sejumlah uang yang disisihkan khusus untuk menghadapi pengeluaran tidak terduga seperti kehilangan pekerjaan, kecelakaan, sakit mendadak, atau perbaikan rumah yang mendesak. Menurut para perencana keuangan profesional, dana darurat adalah fondasi pertama yang harus dibangun sebelum seseorang memulai investasi apapun. Tanpa dana darurat, kondisi keuangan seseorang sangat rentan terhadap guncangan ekonomi yang bisa berdampak jangka panjang.\n\nBesaran dana darurat yang ideal bervariasi tergantung status pekerjaan dan tanggungan seseorang. Bagi karyawan tetap dengan penghasilan stabil, dana darurat minimal setara 3-6 bulan pengeluaran rutin. Untuk pekerja freelance atau wiraswasta dengan penghasilan tidak tetap, angka ini naik menjadi 6-12 bulan pengeluaran. Pengeluaran yang dimaksud bukan hanya kebutuhan pokok makan dan transportasi, melainkan seluruh pengeluaran rutin termasuk cicilan, asuransi, dan tagihan utilitas.\n\nPenempatan dana darurat juga perlu strategis. Uang ini harus mudah diakses kapan saja namun tetap menghasilkan return yang lebih baik dari tabungan biasa. Beberapa opsi penempatan yang populer di Indonesia antara lain deposito on-call yang bisa dicairkan kapan saja, reksa dana pasar uang yang memiliki likuiditas tinggi dengan return rata-rata 4-6% per tahun, atau tabungan khusus di bank digital yang memberikan bunga lebih kompetitif. Yang penting adalah hindari menempatkan dana darurat di instrumen yang memiliki risiko fluktuasi nilai seperti saham.\n\nMemulai membangun dana darurat bisa dimulai dari jumlah kecil. Jika menyisihkan Rp100.000 per minggu saja, dalam satu tahun Anda sudah mengumpulkan Rp5.200.000. Dengan disiplin dan konsistensi, jumlah ini akan terus bertambah. Satu teknik efektif adalah mengatur auto-debit dari rekening gaji ke rekening dana darurat setiap tanggal gajian, sehingga prosesnya otomatis dan tidak tergantung mood menabung.\n\nSurvey OJK tahun 2023 menunjukkan bahwa lebih dari 60% masyarakat Indonesia belum memiliki dana darurat yang memadai. Kondisi ini diperparah oleh budaya konsumtif yang didorong oleh kemudahan kredit dan paylater. Membangun dana darurat bukan hanya soal keuangan, tetapi juga tentang ketenangan pikiran. Dengan dana darurat yang cukup, seseorang bisa menghadapi situasi darurat tanpa harus terpaksa menjual aset dengan harga rendah atau terjerat pinjaman ilegal dengan bunga mencekik.',
      funFact: 'Menurut data Bank Indonesia, rata-rata rumah tangga di Indonesia hanya mampu bertahan 2-3 minggu jika penghasilan utama tiba-tiba berhenti, jauh di bawah rekomendasi minimal 3 bulan.',
    },
    {
      title: 'Memahami Risiko dan Return: Hubungan Fundamental dalam Keuangan',
      content: 'Risiko dan return memiliki hubungan fundamental yang tidak terpisahkan dalam dunia keuangan. Prinsip dasarnya sederhana: semakin tinggi potensi return suatu investasi, semakin tinggi pula risikonya. Konsep ini dikenal sebagai trade-off risk-return dan menjadi landasan dari setiap keputusan investasi yang rasional. Investor yang mengabaikan hubungan ini berisiko mengalami kerugian yang tidak proporsional terhadap ekspektasi keuntungannya.\n\nRisiko dalam konteks keuangan mengacu pada ketidakpastian terhadap hasil yang akan diperoleh dari suatu investasi. Risiko bisa dikategorikan menjadi dua jenis utama: risiko sistematis (market risk) dan risiko tidak sistematis (specific risk). Risiko sistematis adalah risiko yang mempengaruhi seluruh pasar, seperti krisis ekonomi, perubahan suku bunga, atau gejolak politik, dan tidak bisa dihilangkan melalui diversifikasi. Risiko tidak sistematis adalah risiko yang spesifik pada satu perusahaan atau industri, seperti kegagalan manajemen atau produk gagal, dan bisa dikurangi melalui diversifikasi portofolio.\n\nDalam praktik investasi di Indonesia, spektrum risiko-return bisa dilihat dari berbagai instrumen yang tersedia. Di ujung bawah spectrum ada tabungan dan deposito bank yang dijamin LPS, memberikan return rendah (3-5% per tahun) namun risiko sangat minim. Di tengah ada obligasi pemerintah dan reksa dana pendapatan tetap dengan return moderat (6-8%). Di ujung atas ada saham individu dan crypto dengan potensi return sangat tinggi namun risiko kehilangan modal juga sangat besar.\n\nKonsep diversifikasi — "jangan menaruh semua telur dalam satu keranjang" — adalah strategi utama untuk mengelola risiko tidak sistematis. Dengan memiliki campuran aset yang berbeda (saham, obligasi, properti, emas), penurunan nilai satu aset dapat dikompensasi oleh kenaikan aset lainnya. Modern Portfolio Theory yang dikembangkan oleh Harry Markowitz memberikan kerangka matematis untuk menemukan portofolio optimal yang memberikan return tertinggi untuk tingkat risiko tertentu.\n\nPengukuran risiko juga berkembang pesat. Metode tradisional menggunakan standar deviasi return sebagai proksi risiko. Namun, metode modern menggunakan Value at Risk (VaR) yang mengukur kerugian maksimum yang mungkin terjadi pada tingkat kepercayaan tertentu. Untuk investor ritel, yang terpenting adalah memahami toleransi risiko pribadi dan menyesuaikan portofolio investasi dengan profil risiko tersebut, bukan sekadar mengejar return tertinggi tanpa mempertimbangkan kemampuan menahan kerugian.',
      funFact: 'Warren Buffett, investor terkaya di dunia, menghasilkan return rata-rata "hanya" 20% per tahun selama 50+ tahun. Kunci keberhasilannya bukan return yang sangat tinggi, melainkan konsistensi dan pengelolaan risiko yang luar biasa.',
    },
    {
      title: 'Financial Technology: Revolusi Layanan Keuangan di Indonesia',
      content: 'Financial technology atau fintech telah mengubah lanskap layanan keuangan di Indonesia secara fundamental dalam satu dekade terakhir. Dari sekadar aplikasi transfer uang, fintech kini mencakup pembayaran digital, pinjaman online (P2P lending), investasi, asuransi, dan wealth management. Indonesia menjadi salah satu pasar fintech terbesar di Asia Tenggara, didorong oleh populasi yang besar, penetrasi internet yang tinggi, namun inklusi keuangan yang masih rendah.\n\nOJK mencatat bahwa pada akhir 2023, terdapat lebih dari 100 perusahaan fintech yang terdaftar dan berizin di Indonesia. Sektor yang paling berkembang pesat adalah P2P lending dengan total penyaluran pinjaman yang melampaui Rp100 triliun. Namun, pertumbuhan ini juga diiringi dengan tantangan seperti tingkat kredit macet (NPL) yang cukup tinggi di beberapa platform, serta maraknya fintech ilegal yang merugikan konsumen. OJK terus memperketat regulasi untuk memastikan pertumbuhan fintech yang sehat dan berkelanjutan.\n\nSistem pembayaran digital mengalami revolusi besar dengan adanya QR Code Indonesian Standard (QRIS) yang memungkinkan satu QR code diterima oleh semua penyedia pembayaran. Bank Indonesia melaporkan transaksi QRIS mencapai miliaran rupiah per bulan, bahkan digunakan oleh pedagang kaki lima dan UMKM di seluruh pelosok negeri. Dompet digital seperti GoPay, OVO, DANA, dan ShopeePay telah menjadi bagian dari kehidupan sehari-hari masyarakat Indonesia, menggeser peran uang tunai secara signifikan.\n\nDi sektor investasi, fintech telah mendemokratisasi akses pasar modal. Aplikasi seperti Ajaib, Bibit, dan Bareksa memungkinkan investor pemula memulai investasi reksa dana dengan modal minimal Rp10.000. Hal ini sangat berbeda dengan kondisi 10 tahun lalu di mana investasi reksa dana memerlukan minimal investasi yang jauh lebih besar dan proses yang rumit. Robo-advisor yang menggunakan algoritma untuk memberikan rekomendasi portofolio juga mulai populer di kalangan investor muda.\n\nTantangan ke depan bagi ekosistem fintech Indonesia meliputi perlindungan data konsumen, literasi keuangan digital, dan integrasi dengan sistem keuangan tradisional. Bank Indonesia dan OJK terus mengembangkan kerangka regulasi yang adaptif melalui konsep regulatory sandbox, di mana inovasi fintech baru bisa diuji dalam lingkungan yang terkontrol sebelum diluncurkan ke pasar luas. Kolaborasi antara bank tradisional dan fintech — atau yang dikenal sebagai partnership model — diprediksi akan menjadi tren utama dalam tahun-tahun mendatang.',
      funFact: 'Indonesia merupakan negara dengan jumlah pengguna e-wallet terbesar di Asia Tenggara, melampaui Thailand dan Vietnam, dengan lebih dari 200 juta akun dompet digital yang terdaftar pada tahun 2023.',
    },
    {
      title: 'Perencanaan Keuangan untuk Generasi Muda: Panduan Praktis',
      content: 'Perencanaan keuangan di usia muda sering diabaikan karena dianggap terlalu dini atau penghasilan yang masih terbatas. Namun kenyataannya, usia 20-an dan 30-an adalah periode paling kritis untuk membangun fondasi keuangan yang kuat. Keputusan keuangan yang diambil di periode ini akan memiliki dampak eksponensial karena kekuatan waktu dan bunga majemuk. Semakin awal seseorang memulai perencanaan keuangan, semakin besar keuntungan yang akan diperoleh di masa depan.\n\nLangkah pertama dalam perencanaan keuangan untuk generasi muda adalah mencatat dan memahami pola pengeluaran. Banyak orang muda yang tidak menyadari betapa besarnya pengeluaran kecil yang terakumulasi, seperti kopi kekinian, langganan streaming, atau belanja online impulsif. Aplikasi pencatatan keuangan seperti Money Lover, BukuKas, atau fitur budgeting di aplikasi banking digital dapat membantu memvisualisasikan kemana uang mengalir setiap bulan.\n\nSetelah memahami pengeluaran, langkah berikutnya adalah membuat anggaran menggunakan metode 50/30/20. Metode ini mengalokasikan 50% penghasilan untuk kebutuhan pokok (makan, transportasi, sewa), 30% untuk keinginan (hiburan, hobi, makan di restoran), dan 20% untuk tabungan dan investasi. Metode ini cukup fleksibel untuk generasi muda dan memberikan ruang untuk menikmati hidup sambil tetap membangun masa depan keuangan.\n\nInvestasi pertama yang disarankan untuk generasi muda adalah reksa dana pasar uang untuk dana darurat dan reksa dana saham untuk pertumbuhan jangka panjang. Dengan fitur auto-debit bulanan (systematic investment plan), investasi menjadi otomatis dan disiplin. Target akumulasi dana darurat 3-6 bulan pengeluaran harus diprioritaskan sebelum mulai berinvestasi di instrumen yang lebih berisiko seperti saham individu atau crypto.\n\nAspek yang sering terlupakan adalah perlindungan asuransi. Di usia muda, premi asuransi kesehatan dan jiwa masih sangat terjangkau karena risiko kesehatan yang relatif rendah. BPJS Kesehatan memberikan jaminan dasar, namun asuransi kesehatan tambahan (rider) di perusahaan asuransi swasta memberikan layanan yang lebih nyaman dan coverage yang lebih luas. Memiliki asuransi sejak muda juga menghindari risiko ditolak klaim karena penyakit yang sudah ada sebelumnya (pre-existing condition). Kunci sukses perencanaan keuangan generasi muda adalah konsistensi, disiplin, dan kemampuan menunda gratifikasi untuk keuntungan jangka panjang yang jauh lebih besar.',
      funFact: 'Jika seseorang mulai berinvestasi Rp200.000 per bulan sejak usia 22 tahun dengan return 10% per tahun, pada usia 55 tahun ia akan mengumpulkan lebih dari Rp500 juta — sementara total yang diinvestasikan "hanya" sekitar Rp79 juta.',
    },
  ],
  Ekonomi: [
    {
      title: 'Memahami GDP: Indikator Utama Kesehatan Ekonomi Negara',
      content: 'Gross Domestic Product (GDP) atau Produk Domestik Bruto adalah ukuran total nilai semua barang dan jasa yang diproduksi dalam batas wilayah suatu negara dalam periode tertentu. GDP dianggap sebagai indikator paling komprehensif untuk mengukur ukuran dan kesehatan ekonomi suatu negara. Bank Dunia dan IMF menggunakan GDP sebagai dasar untuk menentukan peringkat ekonomi negara-negara di dunia dan merumuskan kebijakan bantuan ekonomi internasional.\n\nGDP Indonesia pada tahun 2023 mencapai sekitar Rp20.000 triliun (sekitar USD 1,3 triliun), menempatkan Indonesia sebagai ekonomi terbesar di Asia Tenggara dan masuk dalam 20 besar ekonomi dunia. Namun, melihat GDP secara absolut saja tidak cukup. GDP per kapita — yang membagi total GDP dengan jumlah penduduk — memberikan gambaran yang lebih akurat tentang tingkat kemakmuran rata-rata penduduk. GDP per kapita Indonesia sekitar USD 4.800, masih di bawah Malaysia (USD 12.000) dan Thailand (USD 7.000), menunjukkan ada ruang besar untuk pertumbuhan.\n\nPerhitungan GDP bisa dilakukan dari tiga pendekatan: pendekatan produksi (menjumlahkan nilai tambah dari semua sektor), pendekatan pengeluaran (C + I + G + (X-M)), dan pendekatan pendapatan (menjumlahkan seluruh pendapatan faktor produksi). Dalam pendekatan pengeluaran, C adalah konsumsi rumah tangga, I adalah investasi, G adalah pengeluaran pemerintah, dan (X-M) adalah ekspor neto. Konsumsi rumah tangga di Indonesia menyumbang sekitar 56-58% dari total GDP, menjadikan daya beli masyarakat sebagai motor utama perekonomian.\n\nNamun, GDP memiliki keterbatasan penting. GDP tidak mencerminkan distribusi pendapatan — sebuah negara bisa memiliki GDP tinggi namun ketimpangan yang parah. GDP juga tidak memperhitungkan degradasi lingkungan, kerja tidak dibayar (seperti pekerjaan rumah tangga), dan kualitas hidup secara keseluruhan. Indeks alternatif seperti Human Development Index (HDI) dan Genuine Progress Indicator (GPI) dikembangkan untuk mengatasi kelemahan ini, meskipun GDP tetap menjadi indikator utama yang paling banyak digunakan.\n\nPertumbuhan GDP Indonesia dalam beberapa tahun terakhir berada di kisaran 5% per tahun, di bawah target pemerintah 7% namun tetap termasuk tinggi dibandingkan rata-rata global. Pemerintah berharap percepatan pertumbuhan bisa dicapai melalui industrialisasi hilir (downstreaming), pembangunan IKN, dan peningkatan investasi asing. Tantangan utama termasuk infrastruktur yang belum merata, biaya logistik yang relatif tinggi, dan tata kelola yang perlu diperbaiki untuk meningkatkan kepercayaan investor.',
      funFact: 'Jika GDP global dipbagi rata kepada seluruh penduduk dunia, setiap orang akan menerima sekitar USD 12.500 per tahun. Namun kenyataannya, 10% orang terkaya di dunia menguasai lebih dari 50% kekayaan global.',
    },
    {
      title: 'Inflasi di Indonesia: Penyebab, Dampak, dan Cara Mengatasinya',
      content: 'Inflasi adalah kecenderungan kenaikan harga barang dan jasa secara umum dan terus-menerus dalam periode waktu tertentu. Bank Indonesia menetapkan target inflasi sebesar 2,5% ± 1% per tahun sebagai tingkat yang dianggap sehat bagi perekonomian. Inflasi yang terlalu rendah bisa mengindikasikan lemahnya permintaan dan stagnasi ekonomi, sementara inflasi yang terlalu tinggi akan menggerus daya beli masyarakat dan menciptakan ketidakpastian ekonomi.\n\nDi Indonesia, inflasi diukur melalui Indeks Harga Konsumen (IHK) yang menghitung perubahan harga dari keranjang barang dan jasa yang dikonsumsi rumah tangga. BPS (Badan Pusat Statistik) memantau harga lebih dari 300 item di 90+ kota setiap bulan. Komponen terbesar penyumbang inflasi Indonesia biasanya berasal dari bahan makanan volatile (beras, cabai, bawang), tarif transportasi, dan biaya perumahan. Inflasi volatile food seringkali melonjak tajam saat musim paceklik atau gangguan distribusi.\n\nPenyebab inflasi bisa berasal dari sisi permintaan (demand-pull inflation) atau sisi penawaran (cost-push inflation). Demand-pull inflation terjadi ketika permintaan melebihi kapasitas produksi, sering dipicu oleh ekspansi kredit yang terlalu cepat atau pengeluaran pemerintah yang berlebihan. Cost-push inflation terjadi ketika biaya produksi meningkat, misalnya akibat kenaikan harga bahan baku impor, depresiasi nilai tukar rupiah, atau kebijakan pajak yang menaikkan biaya usaha.\n\nDampak inflasi terhadap masyarakat tidak merata. Kelompok dengan penghasilan tetap (buruh, pensiunan) paling terdampak karena penghasilan mereka tidak meningkat secepat kenaikan harga. Sebaliknya, kelompok yang memiliki aset produktif (properti, saham) seringkali justru diuntungkan karena nilai aset mereka cenderung naik mengikuti inflasi. Inflasi juga menguntungkan debitur (pihak yang berutang) karena nilai riil utang mereka berkurang seiring waktu, sementara merugikan kreditur.\n\nBank Indonesia menggunakan berbagai instrumen kebijakan moneter untuk mengendalikan inflasi, terutama suku bunga acuan (BI-7 Day Reverse Repo Rate). Ketika inflasi mengancam naik di atas target, BI akan menaikkan suku bunga untuk menyerap kelebihan likuiditas dan memperlambat kredit. Selain itu, pemerintah menggunakan kebijakan fiskal seperti subsidi, impor tambahan, dan operasi pasar untuk menjaga stabilitas harga bahan pokok. Koordinasi antara BI, pemerintah, dan BPS dalam Tim Pengendalian Inflasi Daerah (TPID) menjadi kunci keberhasilan pengendalian inflasi di Indonesia.',
      funFact: 'Hyperinflation terparah dalam sejarah terjadi di Zimbabwe pada tahun 2008, di mana tingkat inflasi mencapai 79,6 miliar persen per bulan. Harga bisa berlipat ganda dalam hitungan jam, dan orang harus membawa tumpukan uang hanya untuk membeli roti.',
    },
    {
      title: 'Supply dan Demand: Hukum Fundamental Ekonomi yang Mengatur Pasar',
      content: 'Hukum penawaran dan permintaan (supply and demand) adalah konsep paling fundamental dalam ekonomi yang menjelaskan bagaimana harga dan kuantitas barang atau jasa ditentukan di pasar bebas. Hukum permintaan menyatakan bahwa semakin tinggi harga suatu barang, semakin rendah kuantitas yang diminta, dan sebaliknya. Hukum penawaran menyatakan bahwa semakin tinggi harga suatu barang, semakin tinggi kuantitas yang ditawarkan oleh produsen. Titik pertemuan kedua kurva inilah yang menentukan harga keseimbangan pasar.\n\nPermintaan tidak hanya dipengaruhi oleh harga, tetapi juga oleh faktor-faktor lain yang disebut determinan permintaan. Pendapatan konsumen adalah determinan penting — ketika pendapatan naik, permintaan akan barang normal akan meningkat, sementara permintaan barang inferior (misalnya mie instan) justru bisa menurun. Harga barang substitusi dan komplementer juga berpengaruh. Jika harga ayam naik, permintaan ikan (substitusi) cenderung meningkat, sementara permintaan bumbu goreng (komplementer) bisa menurun.\n\nElastisitas permintaan mengukur seberapa sensitif kuantitas yang diminta terhadap perubahan harga. Barang kebutuhan pokok seperti beras memiliki permintaan yang inelastis — kenaikan harga tidak mengurangi permintaan secara signifikan karena masyarakat tetap butuh makan. Sebaliknya, barang mewah memiliki permintaan yang elastis — kenaikan harga akan mengurangi permintaan secara drastis. Pemerintah Indonesia menggunakan konsep elastisitas ini saat menetapkan kebijakan pajak, seperti mengenakan PPN yang lebih tinggi untuk barang mewah.\n\nDi pasar nyata Indonesia, contoh penerapan supply-demand bisa dilihat pada fluktuasi harga cabai. Pada musim panen raya, supply cabai melimpah sehingga harga anjlok, seringkali di bawah biaya produksi. Petani yang tidak mampu menyimpan hasil panen terpaksa menjual dengan harga sangat murah. Sebaliknya, pada musim hujan atau saat gangguan distribusi, supply berkurang drastis dan harga cabai bisa melonjak hingga 5-10 kali lipat. Fenomena ini menunjukkan bahwa kurva supply untuk produk pertanian sangat inelastis dalam jangka pendek.\n\nIntervensi pemerintah terhadap mekanisme supply-demand sering dilakukan melalui harga minimum (harga dasar pembelian pemerintah) atau harga maksimum (HET - Harga Eceran Tertinggi). Meskipun intervensi ini bertujuan melindungi produsen atau konsumen, para ekonom sering memperingatkan bahwa distorsi harga yang berlebihan bisa menciptakan ketidakseimbangan baru seperti surplus atau shortage yang justru merugikan perekonomian secara keseluruhan.',
      funFact: 'Pada tahun 1841, seorang ekonom Irlandia bernama Antoine-Augustin Cournot menjadi orang pertama yang menggambarkan kurva supply dan demand dalam grafik matematika, yang kini menjadi ikon universal dalam ilmu ekonomi.',
    },
    {
      title: 'Ekonomi Digital Indonesia: Pertumbuhan dan Tantangan',
      content: 'Ekonomi digital Indonesia telah mengalami pertumbuhan yang luar biasa dalam satu dekade terakhir, didorong oleh penetrasi internet yang masif, populasi muda yang melek teknologi, dan adopsi smartphone yang hampir universal. Menurut laporan Google-Temasek-Bain e-Conomy SEA, nilai ekonomi digital Indonesia diprediksi mencapai lebih dari USD 100 miliar pada tahun 2025, menjadikannya yang terbesar di Asia Tenggara dan salah satu yang terbesar di dunia.\n\nSektor e-commerce menjadi kontributor terbesar ekonomi digital Indonesia, diikuti oleh transportasi online, media digital, dan financial services. Platform seperti Tokopedia, Shopee, dan Lazada telah mengubah cara masyarakat Indonesia berbelanja, bahkan menjangkau pedesaan yang sebelumnya sulit mengakses produk-produk tertentu. UMKM yang masuk ke platform e-commerce mengalami peningkatan omzet rata-rata 2-3 kali lipat dibandingkan penjualan konvensional, dan jutaan UMKM baru terbantu oleh ekosistem logistik digital.\n\nTransformasi digital juga mengubah lanskap ketenagakerjaan. Munculnya profesi baru seperti content creator, social media manager, data analyst, dan gig worker di platform ride-hailing atau food delivery menciptakan jutaan lapangan kerja. Namun, transformasi ini juga menimbulkan kekhawatiran tentang masa depan pekerjaan konvensional yang tergantikan oleh otomatisasi dan kecerdasan buatan. Pemerintah melalui program Prakerja dan revolusi industri 4.0 berupaya meningkatkan kompetensi digital tenaga kerja Indonesia agar mampu beradaptasi dengan perubahan ini.\n\nTantangan besar ekonomi digital Indonesia meliputi kesenjangan digital (digital divide) antara perkotaan dan pedesaan, keamanan siber, dan perlindungan data pribadi. Meskipun penetrasi internet sudah mencapai lebih dari 78%, kualitas koneksi internet di daerah 3T (tertinggal, terdepan, terluar) masih sangat rendah. Pemerintah melalui program Palapa Ring berupaya membangun infrastruktur serat optik yang menjangkau seluruh Indonesia, namun implementasinya masih menghadapi berbagai hambatan teknis dan birokrasi.\n\nKe depan, ekonomi digital Indonesia berpotensi menjadi motor pertumbuhan utama, terutama jika didukung oleh regulasi yang mendukung inovasi, investasi infrastruktur digital yang memadai, dan peningkatan literasi digital masyarakat. Kehadiran IKN (Ibu Kota Nusantara) yang direncanakan sebagai smart city juga diharapkan menjadi showcase teknologi digital terbaru yang bisa direplikasi di kota-kota lain di Indonesia.',
      funFact: 'Indonesia memiliki lebih dari 112 juta pengguna media sosial aktif pada tahun 2024, menjadikannya salah satu negara dengan pengguna media sosial terbanyak di dunia setelah India, China, dan Amerika Serikat.',
    },
    {
      title: 'Kebijakan Moneter Bank Indonesia: Alat dan Dampaknya',
      content: 'Kebijakan moneter adalah kebijakan yang dilakukan oleh bank sentral (Bank Indonesia) untuk mengendalikan jumlah uang beredar, suku bunga, dan nilai tukar dalam upaya mencapai tujuan ekonomi makro, terutama stabilitas harga dan nilai tukar. Bank Indonesia memiliki tiga tujuan utama kebijakan moneter yang dikenal dengan "triple mandate": menjaga stabilitas nilai rupiah, menjaga stabilitas sektor perbankan, dan mendukung pertumbuhan ekonomi yang berkelanjutan.\n\nInstrumen utama kebijakan moneter Bank Indonesia adalah suku bunga acuan, resmi bernama BI-7 Day Reverse Repo Rate. Suku bunga ini menjadi referensi bagi seluruh bank komersial dalam menetapkan suku bunga deposito dan kredit mereka. Ketika BI menaikkan suku bunga acuan, biaya pinjaman meningkat, konsumsi dan investasi melambat, dan inflasi cenderung turun. Sebaliknya, penurunan suku bunga mendorong aktivitas ekonomi namun berisiko memicu inflasi. Keputusan suku bunga BI diumumkan setiap bulan melalui Rapat Dewan Gubernur (RDG).\n\nSelain suku bunga, BI juga menggunakan instrumen operasi pasar terbuka (OMO), yaitu pembelian dan penjualan Surat Berharga Bank Indonesia (SBI) untuk mengatur likuiditas perbankan. Giro Wajib Minimum (GWM) yang mensyaratkan bank menyimpan sebagian dana pihak ketiga di BI juga merupakan instrumen penting. Terakhir, BI menerapkan kebijakan nilai tukar yang dikelola secara fleksibel (managed float), di mana BI melakukan intervensi di pasar valuta asing ketika pergerakan nilai tukar rupiah dianggap tidak mencerminkan fundamental ekonomi.\n\nDalam beberapa tahun terakhir, Bank Indonesia juga mengembangkan kebijakan moneter makroprudensial yang fokus pada stabilitas sistem keuangan secara keseluruhan. Instrumen ini meliputi Loan to Value (LTV) rasio untuk mengendalikan kredit properti, pengetatan aturan uang muka kredit kendaraan bermotor, dan kebijakan countercyclical capital buffer yang mewajibkan bank menambah modal saat kredit tumbuh terlalu cepat. Pendekatan ini melengkapi kebijakan moneter konvensional yang lebih fokus pada inflasi dan nilai tukar.\n\nTantangan terbesar BI saat ini adalah menyeimbangkan antara menjaga stabilitas harga di tengah tekanan global (terutama kebijakan Federal Reserve AS yang mempengaruhi arus modal ke negara berkembang) dan mendukung pemulihan ekonomi domestik. Komunikasi kebijakan yang transparan dan forward guidance — memberikan sinyal arah kebijakan di masa depan — menjadi semakin penting untuk mengelola ekspektasi pelaku ekonomi dan mengurangi volatilitas pasar keuangan.',
      funFact: 'Bank Indonesia didirikan pada tanggal 1 Juli 1953, berawal dari nasionalisasi De Javasche Bank milik Belanda. Hari lahir BI setiap 1 Juli diperingati sebagai Hari Bank Indonesia nasional.',
    },
  ],
  Pajak: [
    {
      title: 'Panduan Lengkap PPh 21: Pajak Penghasilan Karyawan',
      content: 'Pajak Penghasilan Pasal 21 (PPh 21) adalah pajak yang dikenakan atas penghasilan yang diterima oleh karyawan, pegawai negeri, pensiunan, dan penerima penghasilan lain yang sejenis. PPh 21 bersifat final atau dikreditkan terhadap PPh yang terutang, artinya pajak yang sudah dipotong oleh pemberi kerja bisa dikurangkan dari total PPh terutang saat pelaporan SPT tahunan. Bagi sebagian besar karyawan, PPh 21 adalah satu-satunya pajak yang mereka bayar secara langsung, sehingga memahami mekanismenya sangat penting.\n\nTarif PPh 21 menggunakan sistem progresif dengan lima lapisan tarif. Lapisan pertama sebesar 5% untuk penghasilan kena pajak (PKP) hingga Rp60 juta per tahun, kemudian 15% untuk PKP Rp60-250 juta, 25% untuk PKP Rp250-500 juta, 30% untuk PKP Rp500-5 miliar, dan 35% untuk PKP di atas Rp5 miliar. Sistem progresif ini memastikan bahwa orang dengan penghasilan lebih tinggi membayar persentase pajak yang lebih besar, sesuai dengan prinsip keadilan vertikal dalam perpajakan.\n\nPerhitungan PPh 21 bulanan melibatkan beberapa komponen yang perlu dipahami. Penghasilan bruto dikurangi dengan biaya jabatan (5% dari penghasilan bruto, maksimal Rp500.000/bulan untuk karyawan), iuran pensiun yang dibayar karyawan, dan PTKP (Penghasilan Tidak Kena Pajak). PTKP untuk tahun 2024 ditetapkan sebesar Rp54.000.000 untuk wajib pajak single, dengan tambahan Rp4.500.000 untuk status kawin, dan Rp4.500.000 per tanggungan (maksimal 3 tanggungan). Peningkatan PTKP yang diumumkan pemerintah secara periodik membantu mengurangi beban pajak masyarakat.\n\nDalam praktiknya, PPh 21 dihitung dengan metode penghitungan tahunan yang dibagi 12 (untuk karyawan baru) atau metode penghitungan norma (untuk karyawan yang sudah bekerja sejak awal tahun). Employer (pemberi kerja) wajib memotong PPh 21 setiap bulan saat pembayaran gaji dan menyetorkannya ke kas negara paling lambat tanggal 10 bulan berikutnya. Keterlambatan penyetoran dikenakan sanksi bunga 2% per bulan.\n\nDengan berlakunya aturan terbaru, karyawan yang penghasilan brutonyya di bawah Rp4,5 juta per bulan setelah dikurangi biaya jabatan dan iuran pensiun dibebaskan dari PPh 21. Kebijakan ini meringankan beban pajak karyawan bergaji rendah dan menunjukkan komitmen pemerintah untuk menerapkan sistem pajak yang lebih berkeadilan. Setiap karyawan sebaiknya secara berkala memeriksa slip gaji dan potongan PPh 21 untuk memastikan perhitungan sudah benar, serta menyimpan bukti potong untuk keperluan pelaporan SPT tahunan.',
      funFact: 'Indonesia termasuk negara dengan tarif pajak penghasilan tertinggi di ASEAN. Tarif marginal tertinggi Indonesia (35%) lebih tinggi dari Singapura (22%), Thailand (35% tapi dengan threshold jauh lebih tinggi), dan Malaysia (30%).',
    },
    {
      title: 'Cara Menghitung PPN: Pajak Pertambahan Nilai yang Perlu Dipahami',
      content: 'Pajak Pertambahan Nilai (PPN) adalah pajak yang dikenakan atas setiap transaksi penyerahan Barang Kena Pajak (BKP) dan/atau Jasa Kena Pajak (JKP) di dalam Daerah Pabean yang dikenakan oleh pengusaha kena pajak. Dengan tarif standar 11% (naik dari 10% mulai 2022), PPN merupakan salah satu sumber penerimaan pajak terbesar negara setelah PPh badan dan PPh orang pribadi. PPN bersifat tidak langsung, artinya beban pajak sebenarnya ditanggung oleh konsumen akhir, meskipun yang memungut dan menyetorkan adalah pengusaha.\n\nMekanisme PPN menggunakan sistem kredit pajak (input tax credit). Setiap pengusaha kena pajak (PKP) yang membeli barang atau jasa untuk kegiatan usahanya akan membayar PPN kepada pemasok (PPN Keluaran untuk pemasok). PPN ini kemudian dikreditkan ketika PKP tersebut menjual produknya dan memungut PPN dari pembeli (PPN Masuk bagi pembeli). PPN yang harus disetorkan ke kas negara adalah selisih antara PPN yang dipungut dari penjualan (PPN Keluaran) dan PPN yang dibayar untuk pembelian (PPN Masuk). Jika PPN Masuk lebih besar dari PPN Keluaran, kelebihan tersebut bisa dikompensasi ke periode berikutnya atau direklaim.\n\nTidak semua barang dan jasa dikenakan PPN. Beberapa jenis BKP dan JKP yang dibebaskan dari PPN antara lain kebutuhan pokok (beras, jagung, kedelai), jasa keagamaan, jasa pendidikan, jasa kesehatan, jasa sosial, jasa kesenian dan hiburan tertentu, serta transaksi di pasar tradisional. Kelompok barang dan jasa ini sengaja dibebaskan PPN untuk meringankan beban masyarakat berpenghasilan rendah dan mendukung sektor-sektor yang dianggap penting bagi kesejahteraan sosial.\n\nSejak 1 Juli 2022, pemerintah menerapkan tarif PPN 11% sebagai bagian dari reformasi perpajakan. Kenaikan tarif ini dikompensasi dengan penyesuaian batas omzet untuk kewajiban PKP dan pemberian insentif PPN tertentu. Selain itu, pemerintah juga mengenakan PPN untuk e-commerce dan transaksi digital, sehingga marketplace dan platform digital harus memungut PPN atas penjualan yang dilakukan melalui platform mereka.\n\nPerusahaan yang omzetnya di atas Rp4,8 miliar per tahun wajib mendaftar sebagai PKP dan memungut PPN. Namun, PKP kecil dengan omzet di bawah Rp4,8 miliar bisa memilih untuk tidak memungut PPN (dikenakan sebagai PPnBM atau dikenai PPN dengan tarif yang lebih rendah). Pengelolaan PPN yang tepat memerlukan pencatatan yang baik, pemisahan transaksi kena pajak dan tidak kena pajak, serta pemahaman tentang kapan PPN terutang — yaitu saat penyerahan BKP/JKP, bukan saat pembayaran diterima.',
      funFact: 'Jepang mengenakan pajak konsumsi (setara PPN) sebesar 10%, Singapura 9% (GST), dan Malaysia 8% (SST). Indonesia dengan PPN 11% termasuk yang cukup kompetitif dibandingkan rata-rata negara ASEAN lainnya.',
    },
    {
      title: 'SPT Tahunan: Panduan Pelaporan Pajak Online yang Mudah',
      content: 'Surat Pemberitahuan (SPT) Tahunan adalah laporan yang wajib disampaikan oleh setiap wajib pajak kepada Direktorat Jenderal Pajak (DJP) untuk melaporkan penghasilan, harta, kewajiban, dan perhitungan pajak terutang dalam satu tahun pajak. Pelaporan SPT bukan hanya kewajiban hukum, tetapi juga merupakan hak wajib pajak untuk melaporkan penghasilan yang sebenarnya dan mengajukan restitusi (pengembalian pajak kelebihan bayar) jika terutang.\n\nTerdapat dua jenis SPT Tahunan: SPT 1770 untuk wajib pajak orang pribadi yang memiliki penghasilan dari usaha/pekerjaan bebas, dan SPT 1770S untuk wajib pajak orang pribadi yang hanya menerima penggajian (karyawan). SPT 1770S jauh lebih sederhana dan bisa diisi dalam waktu sekitar 15-30 menit. Kedua jenis SPT kini bisa dilaporkan secara online melalui situs e-Filing DJP Online (pajak.go.id) atau aplikasi e-Filing yang disediakan oleh DJP.\n\nProses pelaporan SPT tahunan online dimulai dengan login ke akun DJP Online menggunakan NPWP dan password. Bagi yang belum memiliki akun, aktivasi bisa dilakukan secara online melalui e-Registration. Setelah login, wajib pajak mengisi formulir SPT elektronik dengan data penghasilan, potongan pajak, dan pengurangan yang sesuai. Data dari bukti potong PPh 21 (Formulir 1721-A1/A2) dari pemberi kerja sangat penting sebagai dasar pengisian SPT 1770S.\n\nSalah satu fitur terpenting dalam pelaporan SPT adalah pengisian Daftar Harta dan Kewajiban (Lampiran SPT). Wajib pajak wajib melaporkan seluruh harta yang dimiliki pada akhir tahun pajak, termasuk tanah dan bangunan, kendaraan, harta bergerak lainnya, investasi, kas dan setara kas, serta harta lainnya. Pelaporan harta ini digunakan untuk tujuan profil risiko pajak dan membantu DJP dalam mengidentifikasi potensi ketidaksesuaian antara penghasilan yang dilaporkan dengan harta yang dimiliki.\n\nBatas waktu pelaporan SPT Tahunan untuk wajib pajak orang pribadi adalah 31 Maret setiap tahunnya, sementara untuk badan usaha adalah 30 April. Keterlambatan pelaporan dikenakan denda sebesar Rp100.000 untuk SPT Tahunan orang pribadi. Meskipun denda relatif kecil, keterlambatan atau ketidaklaporan bisa mempengaruhi compliance rating wajib pajak dan berpotensi menurunkan kategori "Wajib Pajak Patuh" yang memberikan berbagai kemudahan layanan. Wajib pajak disarankan untuk tidak menunggu mendekati deadline dan melaporkan SPT lebih awal untuk menghindari kesibukan server di akhir masa pelaporan.',
      funFact: 'Pada tahun 2024, DJP menerima lebih dari 20 juta SPT Tahunan secara online. Proses digitalisasi ini menghemat miliaran rupiah biaya cetak dan distribusi formulir, serta mengurangi waktu proses administrasi dari berminggu-minggu menjadi hitungan menit.',
    },
    {
      title: 'Tax Planning Legal: Strategi Mengoptimalkan Pajak Sesuai Regulasi',
      content: 'Tax planning adalah proses perencanaan penghasilan, kegiatan usaha, dan transaksi keuangan dengan tujuan meminimalkan kewajiban pajak secara legal. Perlu dibedakan dengan tax evasion (penghindaran pajak ilegal) dan tax avoidance (pemanfaatan celah hukum yang melampaui maksud undang-undang). Tax planning yang baik adalah tax planning yang sesuai dengan semangat dan ketentuan perpajakan, mengoptimalkan insentif yang disediakan pemerintah, dan terdokumentasi dengan baik untuk mengantisipasi pemeriksaan pajak.\n\nSalah satu strategi tax planning paling umum adalah memanfaatkan pengurangan-pengurangan yang diizinkan oleh undang-undang. Untuk wajib pajak orang pribadi, ini termasuk menjamin penghitungan PTKP yang optimal (misalnya, jika sudah menikah namun belum melaporkan status kawin ke KPP, segera lakukan perubahan data untuk mendapat tambahan PTKP Rp4.500.000/tahun), mengklaim tanggungan yang sesuai, dan memastikan biaya-biaya yang bisa dikurangkan tercatat dengan baik.\n\nBagi wajib pajak dengan penghasilan usaha, pilihan bentuk usaha menjadi salah satu instrumen tax planning terpenting. Pendirian PT (Perseroan Terbatas) memberikan perlindungan aset pribadi dan tarif PPh badan yang umumnya lebih menguntungkan dibandingkan PPh OP untuk penghasilan di atas rata-rata. Pemisahan usaha menjadi beberapa badan usaha (jika memungkinkan secara substansi bisnis) juga bisa mengoptimalkan penggunaan PTKP dan tarif progresif. Namun, pemisahan ini harus didukung oleh transaksi dan operasi yang nyata, bukan sekadar rekayasa untuk menghindari pajak.\n\nInsentif pajak yang disediakan pemerintah juga merupakan peluang tax planning yang signifikan. Tax holiday (pembebasan pajak) diberikan untuk perusahaan yang berinvestasi di sektor-sektor prioritas di daerah tertentu. Super deduction tax (pengurangan pajak lebih besar dari biaya aktual) diberikan untuk kegiatan litbang dan vokasi. Pemerintah juga menyediakan insentif pajak untuk UMKM berupa PPh final yang lebih rendah (0,5% dari omzet, dibandingkan tarif normal), fasilitas perpajakan untuk kawasan ekonomi khusus (KEK), dan insentif untuk industri hilir.\n\nDalam era Perpajakan Berbasis Transaksi Elektronik, transparansi dan kepatuhan menjadi semakin penting. DJP kini memiliki akses ke data transaksi perbankan, data kepemilikan properti, dan data transaksi digital melalui program AEoI (Automatic Exchange of Information) dan perjanjian FATCA. Oleh karena itu, tax planning harus dilakukan secara terbuka dan mendokumentasikan setiap posisi perpajakan yang diambil. Konsultasi dengan konsultan pajak profesional untuk transaksi besar atau rumit sangat direkomendasikan untuk memastikan posisi perpajakan yang aman dan optimal.',
      funFact: 'Program Tax Amnesty jilid pertama (2016-2017) berhasil mengumpulkan deklarasi harta sebesar Rp4.865 triliun dari 965.952 wajib pajak, menjadikannya salah satu program tax amnesty terbesar di dunia dalam hal jumlah harta yang dideklarasikan.',
    },
    {
      title: 'Self Assessment System: Prinsip Dasar Perpajakan Modern Indonesia',
      content: 'Self Assessment System (SAS) adalah sistem perpajakan di mana wajib pajak diberi kepercayaan untuk menghitung, memperhitungkan, menyetor, dan melaporkan sendiri pajak terutangnya sesuai dengan ketentuan perundang-undangan perpajakan. Indonesia mengadopsi sistem ini sejak reformasi perpajakan tahun 1983 yang mengubah dari official assessment system (di mana otoritas pajak yang menghitung pajak). SAS menempatkan wajib pajak sebagai subjek aktif yang bertanggung jawab atas kepatuhan pajaknya sendiri.\n\nPrinsip dasar SAS adalah bahwa wajib pajak dianggap jujur dan patuh sampai terbukti sebaliknya. Namun, ini bukan berarti DJP tidak melakukan pengawasan. DJP memiliki wewenang yang luas untuk melakukan pemeriksaan pajak, menerbitkan Surat Tagihan Pajak (STP), dan mengenakan sanksi administrasi dan pidana pajak. Sistem ini bekerja dengan keseimbangan antara kepercayaan dan pengawasan — wajib pajak diberi kebebasan untuk mengelola perpajakannya, namun harus siap dipertanggungjawabkan jika terjadi ketidaksesuaian.\n\nImplementasi SAS di Indonesia mencakup beberapa komponen penting. Pertama, wajib pajak wajib mendaftarkan diri untuk mendapatkan NPWP (Nomor Pokok Wajib Pajak). Kedua, wajib pajak harus memungut atau memotong pajak sendiri sesuai ketentuan yang berlaku. Ketiga, wajib pajak harus menyetor pajak yang terutang ke kas negara melalui bank persepsi atau sistem pembayaran elektronik (billing system). Keempat, wajib pajak harus melaporkan SPT tepat waktu sebagai bentuk pertanggungjawaban.\n\nPengawasan kepatuhan pajak dilakukan melalui beberapa mekanisme. Pre-filing notification (PFN) yang diberikan DJP berisi data pihak ketiga yang dimiliki DJP, sehingga wajib pajak bisa membandingkan data yang dilaporkan dengan data yang dimiliki DJP sebelum mengirim SPT. Program compliance risk management mengklasifikasikan wajib pajak berdasarkan profil risiko, sehingga pemeriksaan pajak bisa ditargetkan secara lebih efisien. Data analytics dan artificial intelligence juga semakin digunakan DJP untuk mengidentifikasi pola ketidakpatuhan.\n\nTantangan terbesar SAS di Indonesia adalah tingkat kepatuhan voluntari yang masih relatif rendah. Rasio kepatuhan pelaporan SPT tahunan orang pribadi baru mencapai sekitar 65-70% dari total WP terdaftar. Faktor-faktor yang mempengaruhi kepatuhan meliputi persepsi terhadap keadilan sistem pajak, kualitas pelayanan pajak, kesadaran akan pentingnya pajak untuk pembangunan, dan efektivitas penegakan hukum. Program edukasi perpajakan yang intensif, penyederhanaan prosedur, dan penerapan good governance di DJP menjadi kunci peningkatan kepatuhan pajak di masa depan.',
      funFact: 'Norway adalah salah satu negara dengan tingkat kepatuhan pajak tertinggi di dunia (lebih dari 95%), sebagian karena transparansi pajak — setiap warga negara bisa melihat berapa pajak yang dibayar tetangga mereka secara online.',
    },
  ],
  Investasi: [
    {
      title: 'Panduan Investasi Saham untuk Pemula di Indonesia',
      content: 'Investasi saham merupakan salah satu cara paling populer untuk membangun kekayaan jangka panjang di Indonesia. Bursa Efek Indonesia (BEI) mencatat bahwa jumlah investor saham retail terus meningkat pesat, melampaui 10 juta Single Investor Identification (SID) pada tahun 2024. Namun, banyak investor pemula yang masuk pasar tanpa pemahaman yang memadai, sehingga rentan mengalami kerugian yang sebenarnya bisa dihindari dengan pengetahuan dasar yang tepat.\n\nLangkah pertama untuk mulai berinvestasi saham adalah membuka rekening efek (sekuritas) di perusahaan sekuritas yang terdaftar di BEI. Beberapa sekuritas populer untuk pemula antara lain Ajaib, Bibit, Stockbit, dan sekuritas konvensional seperti Mandiri Sekuritas dan Mirae Asset. Proses pembukaan rekening kini bisa dilakukan sepenuhnya online melalui aplikasi smartphone, dengan modal awal yang sangat terjangkau — beberapa sekuritas bahkan memperbolehkan memulai dengan Rp10.000.\n\nDua pendekatan utama dalam analisis saham adalah analisis fundamental dan analisis teknikal. Analisis fundamental menganalisis laporan keuangan perusahaan, rasio-rasio keuangan (PER, PBV, ROE, DER), prospek industri, dan kualitas manajemen untuk menentukan nilai wajar saham. Seorang investor fundamentalis akan membeli saham ketika harganya berada di bawah nilai wajarnya (undervalued) dan menjual ketika sudah melampaui nilai wajar (overvalued). Analisis teknikal sebaliknya mempelajari pola harga dan volume perdagangan menggunakan grafik untuk memprediksi pergerakan harga di masa depan.\n\nStrategi investasi saham yang disarankan untuk pemula adalah pendekatan buy and hold pada saham-saham blue chip (perusahaan besar dengan fundamental kuat dan histori pembagian dividen yang konsisten). Indeks LQ45 atau IDX30 bisa menjadi referensi awal untuk memilih saham berkualitas. Selain itu, investasi melalui Reksa Dana Indeks ETF yang melacak indeks tertentu memberikan diversifikasi otomatis dengan biaya yang lebih rendah dibandingkan membeli saham individual.\n\nRisiko yang perlu dipahami oleh investor pemula meliputi risiko pasar (harga saham bisa turun tajam), risiko likuiditas (beberapa saham sulit diperjualbelikan), dan risiko fundamental (kinerja perusahaan memburuk). Diversifikasi — memiliki portofolio saham dari berbagai sektor — adalah cara utama mengurangi risiko. Investor pemula juga disarankan untuk tidak menggunakan margin (pinjaman dari sekuritas) dan menghindari trading berlebihan berdasarkan rumor atau FOMO (fear of missing out). Disiplin, kesabaran, dan pendidikan berkelanjutan adalah kunci sukses jangka panjang dalam berinvestasi saham.',
      funFact: 'Jika Anda berinvestasi Rp1.000.000 di saham Telkom Indonesia (TLKM) pada IPO tahun 1995 dan mempertahankannya hingga sekarang termasuk seluruh dividen yang direinvestasi, nilai investasi Anda sudah bertumbuh lebih dari 10.000%.',
    },
    {
      title: 'Dollar Cost Averaging: Strategi Investasi yang Sederhana namun Ampuh',
      content: 'Dollar Cost Averaging (DCA) adalah strategi investasi di mana investor membeli aset dengan jumlah uang yang tetap secara berkala, terlepas dari kondisi pasar. Misalnya, Anda menyetor Rp500.000 setiap bulan ke reksa dana saham. Ketika harga saham turun, Rp500.000 Anda akan membeli lebih banyak unit. Ketika harga naik, Rp500.000 Anda akan membeli lebih sedikit unit. Seiring waktu, harga rata-rata pembelian Anda cenderung lebih rendah dibandingkan harga rata-rata pasar — inilah keunggulan utama strategi DCA.\n\nStrategi DCA sangat cocok untuk investor pemula karena menghilangkan kebutuhan untuk "menebak" timing pasar (market timing), yang bahkan sulit dilakukan oleh profesional sekalipun. Banyak penelitian akademis menunjukkan bahwa DCA menghasilkan return yang hampir setara dengan strategi lump sum (investasi sekaligus) dalam jangka panjang, namun dengan risiko psikologis yang jauh lebih rendah. Investor DCA tidak perlu cemas tentang apakah pasar sedang "tinggi" atau "rendah" — mereka cukup disiplin menyetor sesuai jadwal.\n\nImplementasi DCA di Indonesia sangat mudah berkat fitur auto-debit yang disediakan oleh mayoritas platform investasi. Anda bisa mengatur auto-invest bulanan di aplikasi seperti Ajaib, Bibit, Bareksa, atau langsung melalui manajer investasi. Pilihan instrumen yang cocok untuk DCA meliputi reksa dana saham (terutama yang melacak indeks seperti LQ45 atau IDX Composite), reksa dana campuran, dan ETF. Untuk investor yang lebih berpengalaman, DCA juga bisa diterapkan pada saham individual blue chip.\n\nSalah satu kelemahan DCA dibandingkan lump sum investing adalah bahwa secara statistik, lump sum menghasilkan return sedikit lebih tinggi karena uang bekerja lebih cepat di pasar. Namun, dalam kenyataan, banyak investor yang tidak mampu melakukan lump sum karena tidak memiliki sejumlah besar uang sekaligus. DCA juga membantu mengurangi bias emosional seperti FOMO (ketika pasar naik) dan panik selling (ketika pasar turun), yang seringkali menjadi penyebab utama kerugian investor ritel.\n\nStudi historis terhadap pasar saham Indonesia menunjukkan bahwa investor yang konsisten menerapkan DCA selama 10+ tahun hampir selalu mendapatkan return positif yang mengalahkan inflasi. Bahkan investor yang mulai DCA tepat sebelum krisis keuangan 2008 atau pandemi COVID-19 akhirnya pulih dan mendapatkan keuntungan yang signifikan jika tetap konsisten. Pesan utamanya sederhana: konsistensi dan waktu adalah sekutu terbaik investor, bukan timing pasar atau prediksi jangka pendek.',
      funFact: 'Sebuah studi oleh Vanguard menemukan bahwa strategi DCA mengurangi risiko drawdown (kerugian maksimum) hingga 30% dibandingkan lump sum investing, menjadikannya pilihan yang lebih nyaman secara psikologis bagi kebanyakan investor.',
    },
    {
      title: 'Investasi Emas: Keuntungan, Risiko, dan Cara Memulai',
      content: 'Investasi emas telah menjadi pilihan favorit masyarakat Indonesia selama berabad-abad. Emas dianggap sebagai aset safe haven — nilai cenderung stabil atau bahkan naik saat kondisi ekonomi global tidak menentu. Dalam budaya Indonesia, emas juga memiliki nilai sosial dan budaya yang kuat, seringkali dijadikan simpanan warisan antar-generasi. Namun, memahami cara investasi emas yang tepat sangat penting agar tidak terjebak dalam kerugian yang sebenarnya bisa dihindari.\n\nTerdapat beberapa cara untuk berinvestasi emas di Indonesia. Pertama, emas fisik (batangan atau perhiasan) yang bisa dibeli di toko emas terpercaya seperti Antam, Pegadaian, atau toko emas lokal. Kelebihan emas fisik adalah Anda benar-benar memiliki aset yang bisa disentuh, namun kelemahannya adalah biaya penyimpanan (brankas) dan risiko keamanan. Emas batangan Antam bersertifikat umumnya memiliki spread (selisih harga beli-jual) yang lebih rendah dibandingkan perhiasan.\n\nKedua, emas digital atau tabungan emas yang disediakan oleh platform seperti Pegadaian, BNI, Bank Mandiri, dan aplikasi investasi. Dengan tabungan emas, Anda bisa membeli emas mulai dari Rp10.000 dan emas disimpan secara fisik oleh penyedia layanan. Biaya administrasi bulanan dan biaya cetak (jika ingin mencairkan dalam bentuk fisik) perlu diperhitungkan. Ketiga, ETF emas yang diperdagangkan di bursa saham, memberikan eksposur ke harga emas internasional dengan likuiditas tinggi.\n\
nHarga emas secara historis memiliki korelasi negatif dengan dolar AS — ketika dolar melemah, harga emas cenderung naik. Emas juga berfungsi sebagai lindung nilai terhadap inflasi, meskipun korelasinya tidak sempurna. Dalam 20 tahun terakhir, harga emas dalam rupiah telah tumbuh rata-rata lebih dari 10% per tahun, mengalahkan inflasi dan return deposito. Namun, harga emas juga bisa mengalami koreksi signifikan, seperti yang terjadi pada tahun 2013 ketika harga emas global turun hampir 30% dari puncaknya.\n\nUntuk investor pemula, alokasi emas sebesar 5-15% dari total portofolio investasi umumnya direkomendasikan oleh perencana keuangan. Emas berfungsi sebagai diversifier yang mengurangi risiko keseluruhan portofolio terutama saat pasar saham sedang bergejolak. Strategi DCA juga sangat cocok diterapkan pada investasi emas — membeli sedikit demi sedikit secara rutin akan mengurangi risiko membeli di harga puncak dan memastikan harga rata-rata yang lebih optimal.',
      funFact: 'Indonesia adalah salah satu produsen emas terbesar di dunia. Tambang Grasberg di Papua — salah satu tambang emas terbesar di planet ini — telah menghasilkan lebih dari 1.500 ton emas sejak mulai beroperasi.',
    },
    {
      title: 'Reksa Dana Pasar Uang vs Reksa Dana Saham: Mana yang Cocok untuk Anda?',
      content: 'Reksa dana adalah wadah yang menghimpun dana dari masyarakat pemodal untuk diinvestasikan dalam portofolio efek oleh manajer investasi profesional. Sesuai dengan namanya, reksa dana memungkinkan investor dengan modal kecil untuk ikut berinvestasi di berbagai instrumen keuangan yang sebelumnya hanya bisa diakses oleh investor besar. OJK mencatat bahwa total aset kelolaan (AUM) reksa dana di Indonesia telah melampaui Rp600 triliun, menunjukkan kepercayaan masyarakat yang tinggi terhadap produk investasi ini.\n\nReksa dana pasar uang menginvestasikan minimal 80% portofolionya pada instrumen pasar uang seperti deposito, SBI, dan obligasi berjangka pendek (kurang dari 1 tahun). Karakteristiknya adalah risiko yang sangat rendah, likuiditas tinggi (bisa dicairkan kapan saja dalam 1-2 hari kerja), dan return yang relatif stabil. Rata-rata return reksa dana pasar uang di Indonesia berkisar 4-6% per tahun, sedikit di atas deposito biasa. Cocok untuk dana darurat, parking fund sebelum investasi, atau investor yang sangat konservatif.\n\nReksa dana saham menginvestasikan minimal 80% portofolionya pada saham. Risikonya jauh lebih tinggi karena harga saham berfluktuasi, namun potensi return juga jauh lebih besar. Dalam 10 tahun terakhir, rata-rata return reksa dana saham di Indonesia berkisar 8-15% per tahun, jauh mengalahkan inflasi. Namun, dalam tahun-tahun tertentu bisa mengalami kerugian hingga 20-30% (seperti saat pandemi Maret 2020). Cocok untuk investasi jangka panjang (5+ tahun) dan investor yang memiliki toleransi risiko tinggi.\n\nDi antara keduanya ada reksa dana pendapatan tetap (fokus pada obligasi), reksa dana campuran (kombinasi saham dan obligasi), dan reksa dana terproteksi yang memberikan jaminan minimal investasi awal. Setiap jenis memiliki profil risiko-return yang berbeda dan cocok untuk tujuan investasi yang berbeda pula. Untuk investor pemula, kombinasi reksa dana pasar uang untuk dana darurat dan reksa dana saham/indeks untuk pertumbuhan jangka panjang adalah strategi yang paling umum direkomendasikan.\n\nBiaya investasi reksa dana meliputi biaya pembelian (sales load) 0-2%, biaya penjualan (redemption fee) yang biasanya berlaku untuk pencairan di bawah periode minimum, dan biaya pengelolaan (management fee) yang sudah termasuk dalam NAV (Net Asset Value). Memilih reksa dana berbasis indeks (index fund) bisa menekan biaya pengelolaan secara signifikan karena tidak memerlukan tim analis aktif. Platform online seperti Bareksa dan Bareksa menyediakan perbandingan performa dan biaya berbagai reksa dana untuk membantu investor membuat keputusan yang lebih informasi.',
      funFact: 'Reksa dana indeks yang melacak S&P 500 — indeks 500 perusahaan terbesar AS — telah mengalahkan lebih dari 90% reksa dana aktif dalam jangka panjang 15 tahun. Ini membuktikan bahwa "berenang mengikuti arus" seringkali lebih menguntungkan daripada mencoba mengalahkan pasar.',
    },
    {
      title: 'Portofolio Investasi: Seni Diversifikasi untuk Mengelola Risiko',
      content: 'Diversifikasi portofolio adalah strategi investasi yang mengedepankan prinsip "jangan menaruh semua telur dalam satu keranjang." Konsep ini mengajak investor untuk mendistribusikan modalnya ke berbagai jenis aset, sektor, dan geografi untuk mengurangi risiko keseluruhan tanpa harus mengorbankan potensi return secara signifikan. Harry Markowitz, peraih Nobel Ekonomi tahun 1990, secara matematis membuktikan bahwa diversifikasi yang tepat bisa menurunkan risiko portofolio secara drastis.\n\nPortofolio investasi yang seimbang umumnya terdiri dari beberapa kelas aset utama. Aset berisiko rendah seperti deposito dan reksa dana pasar uang (20-30%) berfungsi sebagai penstabil. Aset berisiko sedang seperti obligasi pemerintah dan reksa dana pendapatan tetap (20-30%) memberikan income yang relatif stabil. Aset berisiko tinggi seperti saham, reksa dana saham, dan properti (30-50%) menjadi motor pertumbuhan jangka panjang. Emas dan komoditas (5-10%) berfungsi sebagai safe haven saat pasar saham bergejolak.\n\nAsset allocation — atau penentuan proporsi masing-masing kelas aset — disepakati oleh para ahli sebagai faktor terbesar yang menentukan performa portofolio, bahkan lebih dari pemilihan saham individual. Sebuah studi terkenal oleh Brinson, Hood, dan Beebower (1986) menemukan bahwa asset allocation menjelaskan lebih dari 90% variasi return portofolio. Artinya, memutuskan berapa persen saham vs obligasi jauh lebih penting daripada memilih saham mana yang akan dibeli.\n\nRebalancing portofolio secara berkala (setiap 6-12 bulan) adalah langkah penting untuk mempertahankan alokasi target. Misalnya, jika target alokasi saham adalah 40% namun kenaikan harga saham membuat proporsinya menjadi 55%, investor perlu menjual sebagian saham dan membeli aset lain untuk kembali ke proporsi 40%. Proses ini memaksa investor untuk "beli rendah, jual tinggi" secara disiplin dan mengurangi risiko portofolio menjadi terlalu agresif atau terlalu konservatif.\n\nDalam konteks Indonesia, diversifikasi juga bisa dilakukan melalui investasi di luar negeri melalui reksa dana global atau ETF internasional. Hal ini penting untuk mengurangi risiko konsentrasi geografis — ketika ekonomi Indonesia mengalami perlambatan, portofolio yang terdiversifikasi secara global tidak akan sepenuhnya terdampak. Kunci keberhasilan diversifikasi adalah memilih aset yang korelasinya tidak terlalu tinggi satu sama lain, sehingga penurunan satu aset tidak secara otomatis menyeret aset lainnya.',
      funFact: 'Ray Dalio, pendiri hedge fund Bridgewater Associates yang mengelola lebih dari USD 150 miliar, mengembangkan strategi "All Weather Portfolio" yang terdiri dari 30% saham, 55% obligasi, dan 15% komoditas — dirancang untuk menghasilkan return positif di berbagai kondisi ekonomi.',
    },
  ],
  Manajemen: [
    {
      title: 'Teori Kepemimpinan Transformational: Memimpin dengan Visi',
      content: 'Kepemimpinan transformational adalah gaya kepemimpinan yang mendorong dan menginspirasi pengikut untuk melampaui ekspektasi mereka sendiri dan mencapai hasil yang luar biasa. Konsep ini pertama kali dikembangkan oleh James MacGregor Burns pada tahun 1978 dan kemudian diperluas oleh Bernard Bass. Berbeda dengan kepemimpinan transaksional yang didasarkan pada sistem reward dan punishment, kepemimpinan transformational berfokus pada perubahan mendasar pada nilai, keyakinan, dan motivasi pengikut.\n\nEmpat komponen utama kepemimpinan transformational menurut Bass adalah: idealized influence (pemimpin sebagai role model yang menginspirasi), inspirational motivation (kemampuan mengkomunikasikan visi yang menarik), intellectual stimulation (mendorong inovasi dan berpikir kreatif), dan individualized consideration (perhatian terhadap kebutuhan individual setiap anggota tim). Pemimpin transformational tidak hanya meminta hasil, tetapi juga mengembangkan kapasitas dan potensi orang-orang yang dipimpinnya.\n\nDalam konteks bisnis Indonesia, kepemimpinan transformational sangat relevan mengingat dinamika budaya dan tantangan transformasi digital yang dihadapi banyak perusahaan. Pemimpin seperti Ciputra (Ciputra Group), Nadiem Makarim (Gojek/ Kemendikbud), dan William Tanuwijaya (Tokopedia) menunjukkan bagaimana visi yang kuat dan kemampuan menginspirasi bisa mengubah industri dan menciptakan dampak sosial yang luas. Mereka tidak hanya memimpin perusahaan, tetapi juga membentuk ekosistem dan mengubah cara masyarakat berpikir dan berperilaku.\n\nRiset empiris secara konsisten menunjukkan bahwa kepemimpinan transformational berkorelasi positif dengan kinerja tim, kepuasan kerja, motivasi intrinsik, dan komitmen organisasi. Tim yang dipimpin oleh pemimpin transformational cenderung lebih kreatif, lebih kooperatif, dan lebih berorientasi pada tujuan jangka panjang. Dalam lingkungan bisnis yang berubah cepat, kemampuan pemimpin untuk menginspirasi adaptasi dan pembelajaran berkelanjutan menjadi keunggulan kompetitif yang sulit ditiru.\n\nMengembangkan kemampuan kepemimpinan transformational memerlukan kesadaran diri yang tinggi, kemampuan komunikasi yang kuat, dan keberanian untuk mengambil risiko. Program pengembangan kepemimpinan yang efektif meliputi coaching eksekutif, mentoring, penugasan lintas fungsi, dan refleksi berkala. Pemimpin juga perlu mengembangkan kecerdasan emosional (emotional intelligence) karena kemampuan memahami dan mengelola emosi sendiri dan orang lain adalah fondasi dari hubungan kepemimpinan yang efektif.',
      funFact: 'Menurut survei Deloitte 2024, 86% karyawan menyatakan bahwa kepemimpinan yang inspiratif adalah faktor nomor satu yang membuat mereka bertahan di sebuah perusahaan, mengalahkan gaji dan benefit.',
    },
    {
      title: 'Agile dan Scrum: Metode Manajemen Proyek Modern',
      content: 'Agile dan Scrum telah menjadi metodologi standar dalam manajemen proyek modern, terutama di industri teknologi dan startup. Berasal dari Agile Manifesto yang ditulis pada tahun 2001 oleh 17 pengembang software, prinsip Agile menekankan pada fleksibilitas, kolaborasi dengan pelanggan, dan pengiriman nilai secara iteratif. Berbeda dengan pendekatan tradisional Waterfall yang bersifat linier dan sekuensial, Agile menerima bahwa perubahan itu tidak terhindarkan dan justru harus dimanfaatkan.\n\nScrum adalah salah satu framework implementasi Agile yang paling populer, digunakan oleh lebih dari 66% perusahaan teknologi menurut State of Agile Report 2023. Scrum mengorganisir pekerjaan dalam sprint — iterasi waktu tetap (biasanya 2-4 minggu) di mana tim mengerjakan sejumlah kecil pekerjaan yang diprioritaskan. Setiap sprint dimulai dengan sprint planning, diikuti oleh daily standup (15 menit setiap hari), dan diakhiri dengan sprint review dan sprint retrospective.\n\nPeran-peran kunci dalam Scrum meliputi Product Owner yang bertanggung jawab atas product backlog dan prioritas fitur, Scrum Master yang memastikan tim mengikuti proses Scrum dan menghilangkan hambatan, dan Development Team yang cross-functional dan self-organizing. Peran Scrum Master bukan manajer tradisional — ia lebih sebagai fasilitator dan coach yang membantu tim bekerja secara optimal tanpa memerintah atau mengendalikan.\n\nPenerapan Agile-Scrum di Indonesia telah melampaui batas industri teknologi. Perusahaan-perusahaan di sektor perbankan (BCA, Mandiri), FMCG (Unilever, Nestle), dan bahkan pemerintahan mulai mengadopsi pendekatan ini untuk meningkatkan kecepatan pengiriman dan responsivitas terhadap perubahan. Bank-bank di Indonesia menggunakan Agile untuk mengembangkan aplikasi mobile banking yang terus diperbarui, sementara perusahaan FMCG menggunakannya untuk meluncurkan kampanye pemasaran yang lebih adaptif.\n\nTantangan implementasi Agile di Indonesia seringkali bukan teknis, melainkan kultural. Budaya hierarkis yang kuat dalam banyak organisasi Indonesia bisa bertentangan dengan prinsip self-organization dan empowernya tim Agile. Selain itu, ekspektasi stakeholder untuk mendapat rencana detail dan timeline yang pasti di awal proyek perlu dikelola dengan komunikasi yang baik tentang sifat iteratif Agile. Kesuksesan implementasi Agile sangat bergantung pada dukungan manajemen puncak dan kesediaan untuk mengubah pola pikir dari "rencana lalu eksekusi" menjadi "eksperimen, belajar, dan adaptasi."',
      funFact: 'Spotify mengembangkan model "Squads, Tribes, Chapters, and Guilds" yang merupakan evolusi dari Scrum. Model ini diadopsi oleh ratusan perusahaan global, termasuk beberapa perusahaan unicorn Indonesia.',
    },
    {
      title: 'Strategic Planning: Seni Merumuskan Strategi Bisnis yang Efektif',
      content: 'Perencanaan strategis (strategic planning) adalah proses sistematis yang digunakan organisasi untuk mendefinisikan arah jangka panjang, mengalokasikan sumber daya, dan menetapkan langkah-langkah konkret untuk mencapai tujuan yang diinginkan. Proses ini bukan sekadar membuat dokumen rencana, melainkan merupakan kerangka berpikir yang membantu organisasi menghadapi ketidakpastian dan membuat keputusan yang konsisten. Henry Mintzberg, salah satu pakar manajemen strategi terkemuka, menyatakan bahwa strategi yang efektif muncul dari kombinasi perencanaan yang disengaja dan kemampuan adaptasi terhadap peluang yang muncul.\n\nAnalisis SWOT (Strengths, Weaknesses, Opportunities, Threats) tetap menjadi alat yang paling banyak digunakan dalam tahap awal perencanaan strategis. Namun, analisis SWOT yang efektif bukan sekadar daftar checklist, melainkan memerlukan analisis mendalam tentang bagaimana kekuatan internal bisa dimanfaatkan untuk menangkap peluang eksternal, dan bagaimana kelemahan internal bisa diperbaiki untuk menghadapi ancaman. Tools analisis lanjutan seperti PESTEL (Political, Economic, Social, Technological, Environmental, Legal), Five Forces Porter, dan Value Chain Analysis memberikan kedalaman yang lebih besar dalam memahami lingkungan bisnis.\n\nVisi dan misi organisasi harus menjadi kompas yang mengarahkan seluruh keputusan strategis. Visi yang kuat bersifat inspiratif, berorientasi masa depan, dan mudah diingat — seperti visi Toyota "Mobility for All" atau visi Bukalapak "Memberdayakan UKM." Misi menjelaskan apa yang organisasi lakukan, untuk siapa, dan bagaimana melakukannya. Tujuan strategis (strategic objectives) kemudian diturunkan dari visi dan misi, menggunakan kerangka SMART (Specific, Measurable, Achievable, Relevant, Time-bound).\n\nBalanced Scorecard yang dikembangkan oleh Robert Kaplan dan David Norton menjadi salah satu kerangka implementasi strategi yang paling banyak diadopsi secara global. Kerangka ini mengukur kinerja organisasi dari empat perspektif: keuangan (bagaimana kita terlihat di mata pemegang saham?), pelanggan (bagaimana pelanggan melihat kita?), proses internal bisnis (proses apa yang harus unggul?), dan pembelajaran-pertumbuhan (bagaimana kita terus memperbaiki dan menciptakan nilai?). Dengan menghubungkan indikator di keempat perspektif, organisasi bisa memastikan bahwa strategi tidak hanya ada di atas kertas tetapi benar-benar dijalankan.\n\nDalam era digital, perencanaan strategis mengalami evolusi signifikan. Siklus perencanaan yang dahulu memakan waktu 6-12 bulan kini diringkas menjadi quarterly strategic reviews yang lebih responsif terhadap perubahan. Data analytics dan business intelligence memungkinkan organisasi membuat keputusan strategis berbasis data yang lebih akurat. Perusahaan-perusahaan terkemuka mengadopsi konsep "strategy as a process" di mana strategi terus diperbarui berdasarkan feedback dari pasar, bukan sekadar dokumen yang dibuat setahun sekali.',
      funFact: 'Kisah Jeff Bezos yang mempertahankan "Regret Minimization Framework" — ia bertanya pada diri sendiri "pada usia 80 tahun, akankah saya menyesal tidak mencoba?" — sebelum keluar dari pekerjaan mapannya untuk mendirikan Amazon, menjadi salah satu contoh decision making strategis paling terkenal.',
    },
    {
      title: 'Manajemen Risiko: Framework Enterprise Risk Management',
      content: 'Enterprise Risk Management (ERM) adalah pendekatan terintegrasi untuk mengidentifikasi, menilai, mengelola, dan memantau risiko secara menyeluruh di seluruh level organisasi. Berbeda dengan pendekatan tradisional yang mengelola risiko secara terpisah di setiap departemen, ERM melihat risiko secara holistik dan mempertimbangkan interaksi antar-risiko. COSO Framework, yang diterbitkan pertama kali pada tahun 2004 dan diperbarui pada tahun 2017, menjadi standar de facto untuk implementasi ERM di seluruh dunia.\n\nProses ERM dimulai dengan penetapan konteks dan appetite for risk organisasi — seberapa banyak risiko yang bersedia diambil untuk mencapai tujuan. Kemudian dilakukan identifikasi risiko secara komprehensif, yang mencakup risiko strategis (kegagalan strategi bisnis), risiko operasional (kerusakan sistem, kesalahan manusia), risiko keuangan (fluktuasi nilai tukar, kredit macet), risiko kepatuhan (pelanggaran regulasi), dan risiko reputasi (kerusakan citra perusahaan). Setiap risiko dinilai berdasarkan likelihood (probabilitas terjadi) dan impact (dampak jika terjadi) untuk menentukan prioritas penanganan.\n\nRespons terhadap risiko bisa dikategorikan menjadi empat strategi: avoid (menghindari risiko dengan tidak melakukan aktivitas yang berisiko), reduce (mengurangi likelihood atau impact melalui kontrol), share/transfer (memindahkan risiko ke pihak lain seperti asuransi), dan accept (menerima risiko jika memang di bawah appetite for risk organisasi). Pemilihan strategi yang tepat bergantung pada analisis cost-benefit dari setiap opsi dan kesesuaian dengan risk appetite organisasi.\n\nImplementasi ERM yang efektif memerlukan komitmen dari board of directors dan manajemen puncak. Chief Risk Officer (CRO) atau setara jabatannya bertanggung jawab untuk mengkoordinasikan seluruh proses ERM, namun pemilik risiko sebenarnya adalah setiap unit bisnis. Dashboard risiko yang menampilkan risk map (heatmap) dan key risk indicators (KRI) menjadi alat yang penting untuk komunikasi risiko kepada manajemen dan pemangku kepentingan. Sistem early warning yang memantau indikator-indikator kritis memungkinkan organisasi mengambil tindakan preventif sebelum risiko menjadi kenyataan.\n\nDi Indonesia, implementasi EMR semakin didorong oleh regulasi OJK yang mewajibkan lembaga keuangan memiliki kerangka manajemen risiko yang komprehensif. Penerapan ERM juga semakin relevan di era digital dengan munculnya risiko-risiko baru seperti cyber risk, data privacy risk, dan risk dari kecerdasan buatan. Organisasi yang memiliki ERM yang matang cenderung lebih tangguh dalam menghadapi krisis dan mampu mengubah risiko menjadi peluang kompetitif.',
      funFact: 'Penelitian oleh Deloitte menemukan bahwa perusahaan dengan program ERM yang matang memiliki return on equity (ROE) rata-rata 25% lebih tinggi dibandingkan perusahaan dengan manajemen risiko yang lemah.',
    },
    {
      title: 'Manajemen Konflik di Tempat Kerja: Mengubah Tantangan Menjadi Peluang',
      content: 'Konflik di tempat kerja adalah fenomena yang tidak terhindarkan dalam setiap organisasi. Menurut Thomas-Kilmann, konflik timbul ketika kepentingan, nilai, atau pendapat antara individu atau kelompok saling bertentangan. Meskipun sering dipandang negatif, konflik yang dikelola dengan baik justru bisa menjadi katalisator inovasi, perbaikan proses, dan penguatan hubungan tim. Kunci pentingnya bukan mengeliminasi konflik, melainkan mengelolanya secara konstruktif.\n\nLima gaya penanganan konflik menurut model Thomas-Kilmann adalah: competing (mengutamakan kepentingan sendiri), accommodating (mengutamakan kepentingan pihak lain), avoiding (menghindari konflik), compromising (mencari solusi tengah), dan collaborating (mencari solusi win-win). Tidak ada gaya yang selalu terbaik — efektivitas tergantung pada situasi dan konteks. Untuk isu yang berkaitan dengan prinsip atau keamanan, competing mungkin diperlukan. Untuk isu kecil yang tidak terlalu penting, accommodating bisa mempertahankan hubungan.\n\nPenyebab konflik di tempat kerja sangat beragam dan bisa dikategorikan menjadi beberapa tipe. Konflik tugas terjadi ketika ada perbedaan pendapat tentang cara menyelesaikan pekerjaan — ini sebenarnya bisa produktif karena mendorong perdebatan ide yang menghasilkan solusi lebih baik. Konflik hubungan terjadi ketika ada ketidakcocokan personal atau kepribadian — ini yang paling destruktif karena sulit diselesaikan dan cenderung memburuk seiring waktu. Konflik proses terjadi ketika ada ketidaksepakatan tentang bagaimana pekerjaan harus dilakukan, termasuk pembagian tanggung jawab dan jadwal.\n\nStrategi pencegahan konflik meliputi komunikasi yang jelas dan transparan, definisi peran dan tanggung jawab yang tegas, mekanisme feedback yang terstruktur, dan pembangunan budaya psikologis safety. Google dalam proyek Aristotle-nya menemukan bahwa psychological safety — perasaan aman untuk mengambil risiko interpersonal — adalah faktor nomor satu yang membedakan tim yang efektif dari yang tidak. Tim dengan psychological safety tinggi bisa menangani perbedaan pendapat tanpa merusak hubungan.\n\nManajer memiliki peran krusial dalam mengelola konflik. Sebagai mediator, manajer harus mampu mendengarkan aktif kedua pihak tanpa mengambil posisi, mengidentifikasi kepentingan di balik posisi masing-masing pihak, dan memfasilitasi dialog yang konstruktif. Teknik "interest-based relational approach" yang dikembangkan oleh Harvard Negotiation Project sangat efektif — fokus pada kepentingan bersama dan menjaga hubungan, bukan pada posisi yang kaku. Pelatihan manajemen konflik untuk manajer dan karyawan terbukti mengurangi tingkat konflik destruktif hingga 40% dan meningkatkan kepuasan kerja secara signifikan.',
      funFact: 'Penelitian dari CPP Global menemukan bahwa karyawan rata-rata menghabiskan 2,8 jam per minggu untuk menangani konflik, yang setara dengan 385 juta hari kerja per tahun di Amerika Serikat saja.',
    },
  ],
};

const DEFAULT_FALLBACK = {
  title: 'Pentingnya Literasi Keuangan di Era Digital',
  content: 'Literasi keuangan adalah kemampuan untuk memahami dan menggunakan berbagai konsep keuangan secara efektif, termasuk mengelola keuangan pribadi, memahami investasi, dan membuat keputusan finansial yang bijak. Menurut survei OJK, tingkat literasi keuangan di Indonesia masih relatif rendah dibandingkan negara-negara ASEAN lainnya. Hal ini menjadi perhatian serius mengingat semakin kompleksnya produk keuangan di era digital yang menuntut pemahaman yang lebih baik dari setiap individu.\n\nMemahami konsep dasar seperti budgeting, saving, compound interest, dan diversifikasi risiko sangat penting untuk mencapai kesejahteraan finansial jangka panjang. Banyak orang yang berpenghasilan tinggi tetapi tidak mampu menabung karena kurangnya perencanaan keuangan. Sebaliknya, orang yang melek keuangan mampu memaksimalkan penghasilannya melalui perencanaan yang tepat, termasuk manfaat pajak, investasi yang efisien, dan manajemen utang yang bijak.\n\nDi era digital, tantangan literasi keuangan semakin meningkat. Munculnya fintech, investasi online, dan produk keuangan digital memerlukan pemahaman yang lebih baik dari konsumen. Kemudahan akses ke produk keuangan melalui smartphone seringkali tidak diimbangi dengan pemahaman yang memadai, menyebabkan banyak orang terjebak dalam produk keuangan berisiko tinggi tanpa menyadarinya. Paylater dan pinjaman online yang sangat mudah diakses telah menimbulkan masalah over-indebtedness di kalangan generasi muda.\n\nPemerintah melalui OJK dan Bank Indonesia terus berupaya meningkatkan literasi keuangan melalui program edukasi, kampanye "Klik Aman," dan integrasi literasi keuangan dalam kurikulum pendidikan. Fintech dan perusahaan keuangan juga memiliki tanggung jawab social untuk menyediakan informasi yang jelas dan transparan tentang produk mereka. Pada akhirnya, literasi keuangan bukan hanya tentang angka, tetapi tentang kemampuan membuat keputusan yang bijak untuk masa depan yang lebih baik.\n\nLangkah pertama yang bisa dilakukan siapa saja adalah mulai mencatat pengeluaran, membuat anggaran, dan memahami produk keuangan sebelum menggunakannya. Dengan kesadaran yang lebih tinggi dan akses informasi yang mudah di era digital, setiap orang memiliki peluang untuk meningkatkan literasi keuangannya dan membangun masa depan keuangan yang lebih cerah.',
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
          content: `Kamu adalah penulis artikel edukasi keuangan dan ekonomi profesional. Tugasmu adalah membuat ringkasan artikel edukatif yang PANJANG dan KOMPREHENSIF dalam bahasa Indonesia.

FORMAT OUTPUT (WAJIB JSON valid, tanpa markdown code block):
{
  "title": "Judul artikel yang menarik dan informatif",
  "content": "Ringkasan artikel 500-700 kata dalam bahasa Indonesia. WAJIB minimal 500 kata. Tulis dalam 5-7 paragraf yang mengalir secara naratif. Jelas, detail, dan mudah dipahami. Berikan contoh konkret, data statistik, dan penjelasan mendalam. JANGAN gunakan format list/bullet/numbering. Gunakan paragraf naratif yang padat dan informatif. Setiap paragraf harus memiliki substansi yang kuat. Setiap paragraf minimal 3-4 kalimat.",
  "funFact": "Satu fakta menarik terkait topik dalam 1-2 kalimat. Bisa berupa data statistik mengejutkan, sejarah yang jarang diketahui, atau trivia yang menginspirasi."
}

PERINGATAN KETAT:
- Konten HARUS PANJANG dan DETAIL, minimal 500 kata, target ideal 600-700 kata
- Hitung kata-katamu! Jangan berhenti sebelum mencapai 500 kata minimum
- Jangan ulang-ulang poin yang sama — kembangkan setiap ide secara mendalam
- Berikan kedalaman penjelasan, contoh nyata, dan konteks yang luas
- Gunakan transisi yang natural antar paragraf
- Setiap paragraf HARUS memiliki 3-5 kalimat yang substansial
- JANGAN gunakan poin-poin atau daftar — tulis dalam format paragraf naratif
- Output HANYA JSON valid, tanpa teks tambahan apapun sebelum atau sesudah`,
        },
        {
          role: 'user',
          content: `Buatkan ringkasan edukatif yang SANGAT PANJANG (minimal 500 kata, idealnya 600-700 kata) dan mendalam tentang topik "${topic}" berdasarkan konten berikut. Kamu HARUS menulis minimal 5 paragraf panjang:

Judul: ${pageTitle}
Konten: ${pageText.substring(0, 12000)}`,
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