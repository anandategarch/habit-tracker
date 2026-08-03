'use client';

import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore, type HelpSectionId } from '@/store/app-store';
import { cn } from '@/lib/utils';

// ── Small reusable info icon button ──────────────────────────────────────
// Used in section headers across Daily Recap. Clicking it opens the help
// modal auto-scrolled to the matching section. Kept tiny + muted so it
// doesn't compete with the section title.
export function HelpInfoButton({ section, label }: { section: HelpSectionId; label?: string }) {
  const openHelp = useAppStore((s) => s.openHelp);
  return (
    <button
      type="button"
      onClick={() => openHelp(section)}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
      aria-label={label ? `Bantuan: ${label}` : 'Bantuan perhitungan'}
      title="Lihat cara hitung"
    >
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 3a5 5 0 110 10 5 5 0 010-10zm0 1.75a.85.85 0 00-.85.85v3.2a.85.85 0 001.7 0v-3.2A.85.85 0 008 4.75zm0 5.9a1 1 0 100 2 1 1 0 000-2z"/>
      </svg>
    </button>
  );
}

// ── Section content type ────────────────────────────────────────────────
interface Metric {
  name: string;
  formula: string;
  source: string;
}

interface HelpSection {
  id: HelpSectionId;
  emoji: string;
  title: string;
  intro?: string;
  metrics: Metric[];
}

// ── All help content (Bahasa Indonesia, non-technical) ──────────────────
const SECTIONS: HelpSection[] = [
  {
    id: 'proyeksi',
    emoji: '📈',
    title: 'Proyeksi Akhir Bulan',
    intro: 'Bagian ini memperkirakan total pengeluaran kamu sampai akhir bulan, berdasarkan pola belanja saat ini.',
    metrics: [
      {
        name: 'Proyeksi Akhir Bulan',
        formula: '(pengeluaran bulan ini ÷ hari yang sudah lewat) × total hari di bulan',
        source: 'Semua transaksi pengeluaran bulan ini. Kalau pilih kategori di dropdown "Dasar", cuma kategori itu yang dihitung.',
      },
      {
        name: 'Rate/hari',
        formula: 'pengeluaran bulan ini ÷ hari yang sudah lewat',
        source: 'Sama seperti proyeksi — bulan berjalan, bukan rata-rata 7 hari. Jadi rate × total hari = proyeksi (konsisten).',
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
        name: 'Top Projected Category',
        formula: 'Kategori dengan proyeksi tertinggi di akhir bulan.',
        source: 'Proyeksi per-kategori: (month-to-date kategori ÷ hari lewat) × total hari.',
      },
      {
        name: 'Over Budget Warning',
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
        name: 'Max tx',
        formula: 'Transaksi tunggal terbesar di periode terpilih.',
        source: 'Bulan ini atau all-time, tergantung tab aktif.',
      },
      {
        name: 'Avg tx',
        formula: 'Rata-rata nominal per transaksi di periode terpilih.',
        source: 'Total ÷ jumlah transaksi di periode itu.',
      },
      {
        name: 'Max/day',
        formula: 'Total harian terbesar di periode terpilih (gabungan semua tx di 1 hari).',
        source: 'Diakumulasi per hari Jakarta, lalu ambil yang tertinggi.',
      },
      {
        name: 'Avg/day',
        formula: 'Rata-rata total harian, hanya hari yang ADA transaksi (bukan dibagi semua hari).',
        source: 'Total ÷ jumlah hari aktif. Avg gak ter-dilute oleh hari no-spend.',
      },
      {
        name: 'Delta Badge (↑ 66k above avg / ↓ di bawah avg)',
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
    title: 'Aktivitas per Jam (Heatmap)',
    intro: '48 bar — 1 bar = 30 menit. Tip: hover bar untuk lihat jam + nominal tepat.',
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
    title: 'Cash Flow & Savings',
    intro: 'Kesehatan keuangan harian berdasarkan income vs expense.',
    metrics: [
      {
        name: 'Cash Flow Status (Sehat / Hati-hati / Boros)',
        formula: 'Rasio pengeluaran ÷ pemasukan hari ini. ≤0.7 sehat, ≤1 hati-hati, >1 boros.',
        source: 'Transaksi income + expense hari ini. Kalau gak ada income, status = Boros (kalau ada expense).',
      },
      {
        name: 'Savings Rate %',
        formula: '(pemasukan − pengeluaran) ÷ pemasukan × 100',
        source: 'Hari ini. 100% kalau ada income tapi 0 expense. 0% kalau gak ada income.',
      },
      {
        name: 'Transaction Diversity',
        formula: 'Jumlah kategori unik yang ada transaksinya hari ini.',
        source: 'Hari ini. Diversity tinggi = belanja tersebar di banyak kategori.',
      },
    ],
  },
  {
    id: 'patterns',
    emoji: '📅',
    title: 'Patterns & Comparisons',
    intro: 'Pola spending harian, mingguan, dan perbandingan dengan periode lalu.',
    metrics: [
      {
        name: 'Best/Worst Day',
        formula: 'Hari dengan pengeluaran terendah (Best 🏆) dan tertinggi (Worst 📉) bulan ini.',
        source: 'Bulan ini. Hanya hari yang ada transaksi (bukan 0 = no-track).',
      },
      {
        name: 'Day-of-Week Pattern',
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
        name: 'Late Night Spending Alert',
        formula: 'Transaksi pengeluaran antara 22:00-04:59 Jakarta.',
        source: 'Hari ini. Total + jam transaksi pertama ditampilkan.',
      },
      {
        name: 'Recurring Detection',
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
        name: 'Budget Snapshot (History)',
        formula: 'Snapshot akhir bulan: budget asli, spent aktual, rollover in/out, effective budget.',
        source: 'Tabel BudgetSnapshot. Auto-saved tiap akhir bulan.',
      },
    ],
  },
];

// ── Main Help Modal Component ───────────────────────────────────────────
export function HelpCalculationModal() {
  const { helpOpen, helpDefaultSection, closeHelp } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the section that triggered the open (if any).
  // Radix Dialog mounts DialogContent via portal AFTER open becomes true,
  // so scrollRef is null on first render. We retry a few times with
  // increasing delay until the container + target are both mounted.
  useEffect(() => {
    if (!helpOpen) return;
    let cancelled = false;
    const tryScroll = (attempt: number) => {
      if (cancelled) return;
      const container = scrollRef.current;
      if (!container) {
        // Container not mounted yet — retry
        if (attempt < 10) setTimeout(() => tryScroll(attempt + 1), 80);
        return;
      }
      if (helpDefaultSection) {
        const target = container.querySelector(`[data-help-section="${helpDefaultSection}"]`) as HTMLElement | null;
        if (!target) {
          // Target not mounted yet — retry
          if (attempt < 10) setTimeout(() => tryScroll(attempt + 1), 80);
          return;
        }
        container.scrollTo({
          top: Math.max(0, target.offsetTop - 8),
          behavior: 'smooth',
        });
        return;
      }
      // No specific section — scroll to top
      container.scrollTo({ top: 0, behavior: 'auto' });
    };
    // Initial attempt after a short delay to let the dialog open transition start
    setTimeout(() => tryScroll(0), 100);
    return () => { cancelled = true; };
  }, [helpOpen, helpDefaultSection]);

  return (
    <Dialog open={helpOpen} onOpenChange={(open) => { if (!open) closeHelp(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-lg">📖</span>
            <span>Cara Hitung Aplikasi</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Penjelasan singkat semua perhitungan di Daily Recap, Finance, dan Budget. Bahasa Indonesia, non-teknis.
          </p>
        </DialogHeader>

        {/* Scrollable content area.
            `relative` + `overflow-y-auto` makes this the offsetParent for
            children's offsetTop, so we can compute scroll targets reliably. */}
        <div ref={scrollRef} className="relative overflow-y-auto custom-scrollbar px-5 py-4 space-y-5 flex-1 min-h-0">

          {SECTIONS.map((section) => (
            <section
              key={section.id}
              data-help-section={section.id}
              className="scroll-mt-4"
            >
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 -mx-1 px-1 z-10">
                <span className="text-base">{section.emoji}</span>
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              </div>

              {/* Section intro */}
              {section.intro && (
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  {section.intro}
                </p>
              )}

              {/* Metrics list */}
              <div className="space-y-2">
                {section.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                  >
                    <p className="text-xs font-semibold text-foreground mb-1">{metric.name}</p>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        <span className="text-muted-foreground font-medium">Rumus: </span>
                        {metric.formula}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="font-medium">Data: </span>
                        {metric.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Footer note */}
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed">
              💡 Semua perhitungan pakai timezone Asia/Jakarta (WIB). Transaksi yang kamu catat dengan jam lokal akan otomatis dikonversi ke WIB untuk konsistensi.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
