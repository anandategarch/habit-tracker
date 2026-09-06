// ─────────────────────────────────────────────────────────────────────────
// Pure static help content for HelpInfoButton — 8 sections of contextual
// metric explanations (formula + data source) in Bahasa Indonesia.
//
// This file holds NO React code, NO hooks, NO closures — just data and types.
// Extracted verbatim from help-calculation.tsx (PHASE-A-1) to slim the
// component file from 515 → ~200 lines. Follows the established
// `*-helpers.ts` / `*-types.ts` sibling-file pattern used across the
// habit-tracker component folder.
// ─────────────────────────────────────────────────────────────────────────

// ── Section content type ────────────────────────────────────────────────
export interface Metric {
  name: string;
  formula: string;
  source: string;
}

export interface HelpSection {
  id: HelpSectionId;
  emoji: string;
  title: string;
  intro?: string;
  metrics: Metric[];
}

// Section IDs — used by HelpInfoButton to pick the right content.
// Keep in sync with the SECTIONS array below.
export type HelpSectionId =
  | 'proyeksi'
  | 'insight'
  | 'gamifikasi'
  | 'cashflow'
  | 'patterns'
  | 'heatmap'
  | 'overview'
  | 'budget';

// ── All help content (Bahasa Indonesia, non-technical) ──────────────────
// Each section is shown INDEPENDENTLY in a small popover anchored to the
// info icon on that section's header. This is more contextual than a
// single big modal — the user only sees help for the section they're
// currently looking at, no cognitive overload from unrelated metrics.
export const SECTIONS: HelpSection[] = [
  {
    id: 'proyeksi',
    emoji: '📈',
    title: 'Proyeksi Akhir Bulan',
    intro: 'Memperkirakan total pengeluaran sampai akhir bulan, berdasarkan pola belanja saat ini.',
    metrics: [
      {
        name: 'Proyeksi Akhir Bulan',
        formula: '(pengeluaran bulan ini ÷ hari yang sudah lewat) × total hari di bulan',
        source: 'Semua transaksi pengeluaran bulan ini. Kalau pilih kategori di dropdown "Dasar", cuma kategori itu yang dihitung.',
      },
      {
        name: 'Rate/hari',
        formula: 'pengeluaran bulan ini ÷ hari yang sudah lewat',
        source: 'Bulan berjalan, bukan rata-rata 7 hari. Jadi rate × total hari = proyeksi (konsisten).',
      },
      {
        name: 'vs semua Rp Y',
        formula: 'proyeksi semua kategori (tanpa filter)',
        source: 'Muncul cuma kalau kamu pilih kategori tertentu di dropdown "Dasar". Bandingkan proyeksi filter vs semua.',
      },
      {
        name: 'Confidence (🎯 Akurat / ⚖️ Cukup / 🎲 Kasar)',
        formula: 'Coefficient of variation (CV) dari pengeluaran harian. CV rendah = pola stabil = akurat.',
        source: 'Variansi pengeluaran harian bulan ini (atau kategori terpilih kalau difilter).',
      },
      {
        name: 'Accuracy Badge (Proyektor Andal)',
        formula: 'Bandingkan proyeksi bulan lalu (di hari yang sama) vs aktual total bulan lalu. ≤10% off = Andal, ≤25% = cukup, >25% = kasar.',
        source: 'Transaksi bulan lalu. Muncul setelah hari ke-3 bulan ini (butuh minimal 3 hari data).',
      },
      {
        name: 'What-if Slider',
        formula: 'base + (base ÷ hari lewat) × (1 − %hemat ÷ 100) × sisa hari',
        source: 'Pengeluaran bulan ini sampai hari ini. Geser slider untuk simulasi "kalau aku hemat X% sampai akhir bulan".',
      },
      {
        name: 'Budget Compliance %',
        formula: 'Kemungkinan tetap on budget, berdasarkan proyeksi vs target bulanan.',
        source: 'Target bulanan = daily budget × hari di bulan, ATAU weekly budgets (yang mana saja aktif).',
      },
      {
        name: 'Besok max (Smart Cap)',
        formula: 'sisa budget bulanan ÷ sisa hari di bulan',
        source: 'Budget target bulanan + pengeluaran bulan ini. Cap harian supaya gak over budget.',
      },
      {
        name: 'Budget habis dalam X hari',
        formula: 'sisa budget ÷ rata-rata pengeluaran 7 hari terakhir',
        source: 'Rate 7 hari (bukan MTD) — lebih reflektif kondisi terkini.',
      },
      {
        name: 'Kategori Proyeksi Tertinggi',
        formula: 'Kategori dengan proyeksi tertinggi di akhir bulan.',
        source: 'Proyeksi per-kategori: (month-to-date kategori ÷ hari lewat) × total hari.',
      },
      {
        name: 'Peringatan Over Budget',
        formula: 'Proyeksi > target bulanan.',
        source: 'Selisih proyeksi vs target = jumlah over budget.',
      },
    ],
  },
  {
    id: 'insight',
    emoji: '🧠',
    title: 'Insight per Kategori',
    intro: 'Statistik mendalam per kategori yang ada transaksinya hari ini. Bisa switch antara "Bulan ini" dan "All-time".',
    metrics: [
      {
        name: 'Tab "Bulan ini" vs "All-time"',
        formula: 'Bulan ini = transaksi bulan Jakarta berjalan. All-time = semua transaksi yang pernah dicatat.',
        source: '30 hari window tetap dipakai internal untuk delta badge + anomaly, tapi gak ditampilkan di tab (redundant dengan Bulan ini).',
      },
      {
        name: 'Tx tertinggi',
        formula: 'Transaksi tunggal terbesar di periode terpilih.',
        source: 'Bulan ini atau all-time, tergantung tab aktif.',
      },
      {
        name: 'Rata-rata tx',
        formula: 'Rata-rata nominal per transaksi di periode terpilih.',
        source: 'Total ÷ jumlah transaksi di periode itu.',
      },
      {
        name: 'Tertinggi/hari',
        formula: 'Total harian terbesar di periode terpilih (gabungan semua tx di 1 hari).',
        source: 'Diakumulasi per hari Jakarta, lalu ambil yang tertinggi.',
      },
      {
        name: 'Rata-rata/hari',
        formula: 'Rata-rata total harian, hanya hari yang ADA transaksi (bukan dibagi semua hari).',
        source: 'Total ÷ jumlah hari aktif. Avg gak ter-dilute oleh hari no-spend.',
      },
      {
        name: 'Delta Badge (↑ 66k di atas avg / ↓ di bawah avg)',
        formula: 'pengeluaran hari ini di kategori ini − rata-rata harian 30 hari.',
        source: 'Selalu pakai 30 hari window (bukan tab). Hijau = di bawah avg (hemat), merah = di atas avg (boros).',
      },
      {
        name: 'Anomali (z-score)',
        formula: '(pengeluaran hari ini − rata-rata) ÷ standar deviasi. z > 1.5 = anomali.',
        source: '30 hari window. Muncul di section "Anomali terdeteksi" kalau ada kategori yang spendingnya jauh di atas normal.',
      },
      {
        name: 'Persentase (X%)',
        formula: 'pengeluaran kategori hari ini ÷ total pengeluaran hari ini × 100',
        source: 'Hari ini doang, bukan bulan atau all-time.',
      },
    ],
  },
  {
    id: 'heatmap',
    emoji: '📊',
    title: 'Aktivitas per Jam',
    intro: '48 bar — 1 bar = 30 menit. Hover bar untuk lihat jam + nominal tepat.',
    metrics: [
      {
        name: '48 Bar (30-menit granularity)',
        formula: 'bucket = jam × 2 + (menit ≥ 30 ? 1 : 0). Contoh: 08.30 → bucket 17.',
        source: 'Transaksi pengeluaran hari ini. Bucket 0 = 00.00-00.29, bucket 47 = 23.30-23.59.',
      },
      {
        name: 'Warna bar',
        formula: 'Ungu = malam (22:00-04:59), Kuning = pagi (05:00-11:59), Utama = siang (12:00-17:59), Biru = sore (18:00-21:59).',
        source: 'Berdasarkan jam Jakarta.',
      },
      {
        name: 'Tinggi bar',
        formula: 'Nominal di bucket itu ÷ nominal bucket tertinggi × 100%.',
        source: 'Normalisasi ke bar tertinggi supaya semua bar kelihatan proporsional.',
      },
    ],
  },
  {
    id: 'gamifikasi',
    emoji: '🎮',
    title: 'Gamifikasi & Streaks',
    intro: 'Motivasi harian lewat streak, badge, dan personal record.',
    metrics: [
      {
        name: 'No-Spend Streak',
        formula: 'Hari berturut-turut dengan 0 pengeluaran (tapi ada transaksi tercatat).',
        source: '30 hari terakhir. Hari tanpa transaksi apapun gak dihitung (bukan no-spend, tapi no-track).',
      },
      {
        name: 'Smart Spender Streak',
        formula: 'Hari berturut-turut pengeluaran di bawah rata-rata 7 hari.',
        source: '7 hari window. No-spend day break streak ini.',
      },
      {
        name: 'Budget Streak',
        formula: 'Hari berturut-turut pengeluaran ≤ daily budget target.',
        source: 'Hanya aktif kalau kamu set daily budget. Streak break kalau over budget.',
      },
      {
        name: 'Combo Multiplier',
        formula: 'Math.floor(budgetStreak ÷ 3) + 1. Contoh: 6 hari on budget = 3× combo.',
        source: 'Budget streak. Maksimum unlimited (tergantung streak).',
      },
      {
        name: 'Daily Badge',
        formula: 'Badge harian otomatis: No-Spend Day 💎, Budget Master 🎯, Streak Master 🔥, Frugal Star ⭐.',
        source: 'Pengeluaran hari ini vs budget + streak. Dipilih yang paling prestisius.',
      },
      {
        name: 'Personal Record',
        formula: 'Ranking pengeluaran hari ini vs semua hari di bulan ini (1 = terendah = terhemat).',
        source: 'Bulanan. Muncul "NEW RECORD" kalau hari ini = pengeluaran terendah bulan.',
      },
      {
        name: 'Personality Tag',
        formula: 'Tag otomatis berdasarkan spending pattern hari ini.',
        source: 'No-Spend Master, Big Spender, Smart Spender, Mindful Spender, Wild Spender, Steady Spender.',
      },
    ],
  },
  {
    id: 'cashflow',
    emoji: '💰',
    title: 'Arus Kas & Tabungan',
    intro: 'Kesehatan keuangan harian berdasarkan income vs expense.',
    metrics: [
      {
        name: 'Status Arus Kas (Sehat / Hati-hati / Boros)',
        formula: 'Rasio pengeluaran ÷ pemasukan hari ini. ≤0.7 sehat, ≤1 hati-hati, >1 boros.',
        source: 'Transaksi income + expense hari ini. Kalau gak ada income, status = Boros (kalau ada expense).',
      },
      {
        name: '% Tingkat Menabung',
        formula: '(pemasukan − pengeluaran) ÷ pemasukan × 100',
        source: 'Hari ini. 100% kalau ada income tapi 0 expense. 0% kalau gak ada income.',
      },
      {
        name: 'Diversitas Transaksi',
        formula: 'Jumlah kategori unik yang ada transaksinya hari ini.',
        source: 'Hari ini. Diversity tinggi = belanja tersebar di banyak kategori.',
      },
    ],
  },
  {
    id: 'patterns',
    emoji: '📅',
    title: 'Pola & Perbandingan',
    intro: 'Pola spending harian, mingguan, dan perbandingan dengan periode lalu.',
    metrics: [
      {
        name: 'Hari Terbaik/Terburuk',
        formula: 'Hari dengan pengeluaran terendah (Best 🏆) dan tertinggi (Worst 📉) bulan ini.',
        source: 'Bulan ini. Hanya hari yang ada transaksi (bukan 0 = no-track).',
      },
      {
        name: 'Pola per Hari',
        formula: 'Rata-rata pengeluaran per hari dalam seminggu (Min-Sab).',
        source: '30 hari terakhir. Kelihatan hari apa kamu paling boros.',
      },
      {
        name: 'vs Kemarin (↑/↓ X%)',
        formula: '(pengeluaran hari ini − kemarin) ÷ kemarin × 100',
        source: 'Hari ini vs hari kemarin (Jakarta).',
      },
      {
        name: 'vs Rata-rata 7 Hari (↑/↓ X%)',
        formula: '(pengeluaran hari ini − rata-rata 7 hari) ÷ rata-rata 7 hari × 100',
        source: '7 hari terakhir termasuk hari ini.',
      },
      {
        name: 'Peringatan Pengeluaran Malam Hari',
        formula: 'Transaksi pengeluaran antara 22:00-04:59 Jakarta.',
        source: 'Hari ini. Total + jam transaksi pertama ditampilkan.',
      },
      {
        name: 'Deteksi Transaksi Berulang',
        formula: 'Transaksi dengan deskripsi sama + nominal ±10% di ≥3 bulan berbeda.',
        source: '95 hari terakhir (3+ bulan coverage).',
      },
    ],
  },
  {
    id: 'overview',
    emoji: '📊',
    title: 'Finance Overview (Ringkasan)',
    intro: 'Card ringkasan di tab Finance → Ringkasan.',
    metrics: [
      {
        name: 'Saldo Bulan Ini',
        formula: 'Total balance semua sumber dana (Kas, Bank, dll).',
        source: 'Tabel FundSource. Diupdate otomatis tiap transaksi (atomic increment).',
      },
      {
        name: 'Pemasukan Bulan Ini',
        formula: 'Total transaksi type=income bulan ini.',
        source: 'Bulan Jakarta berjalan.',
      },
      {
        name: 'Pengeluaran Bulan Ini',
        formula: 'Total transaksi type=expense bulan ini.',
        source: 'Bulan Jakarta berjalan.',
      },
      {
        name: 'vs Bulan Lalu (↑/↓ X%)',
        formula: '(bulan ini − bulan lalu) ÷ bulan lalu × 100',
        source: 'Bulan berjalan vs bulan sebelumnya, di tanggal yang sama (untuk perbandingan adil).',
      },
    ],
  },
  {
    id: 'budget',
    emoji: '🎯',
    title: 'Budget',
    intro: 'Budget per kategori + weekly budget dengan rollover.',
    metrics: [
      {
        name: 'Budget per Kategori',
        formula: 'Target bulanan atau mingguan per kategori. Progress bar = spent ÷ budget × 100.',
        source: 'Tabel Budget. Spent = transaksi bulan ini di kategori itu.',
      },
      {
        name: 'Status (Under / On Track / Nearing / Over)',
        formula: '<50% under, <80% on track, <100% nearing, ≥100% over.',
        source: 'Persentase progress.',
      },
      {
        name: 'Sisa/hari (Budget cards)',
        formula: 'sisa budget ÷ sisa hari di bulan',
        source: 'Budget bulanan + hari tersisa. Estimasi max harian supaya gak over.',
      },
      {
        name: 'Weekly Budget + Rollover',
        formula: '4 minggu per bulan (1-7, 8-14, 15-21, 22-end). Sisa budget minggu ini masuk ke minggu depan kalau rollover aktif.',
        source: 'Tabel WeeklyBudget. Auto-reset tiap bulan.',
      },
      {
        name: 'Snapshot Budget (Riwayat)',
        formula: 'Snapshot akhir bulan: budget asli, spent aktual, rollover in/out, effective budget.',
        source: 'Tabel BudgetSnapshot. Auto-saved tiap akhir bulan.',
      },
    ],
  },
];

// Lookup map for O(1) section find by ID.
export const SECTION_MAP = new Map<HelpSectionId, HelpSection>(SECTIONS.map((s) => [s.id, s]));
