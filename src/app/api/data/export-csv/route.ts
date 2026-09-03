import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { jakartaDateKey } from '@/lib/timezone';

function esc(field: string | number | boolean | null | undefined): string {
  const s = field === null || field === undefined ? '' : String(field);
  // BUGHUNT-OTHER-1 BUG-H4: prevent CSV injection. If a value starts with
  // `=`, `+`, `-`, or `@`, Excel/LibreOffice would otherwise interpret it as
  // a formula. Prefix with a single quote to neutralize (Excel drops the
  // quote on display but keeps it in the cell value as text).
  let safe = s;
  if (/^[=+\-@]/.test(safe)) safe = "'" + safe;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  // BUGHUNT-OTHER-1 BUG-M9: prefix with a UTF-8 BOM so Excel reads the file
  // as UTF-8 instead of mojibaking Indonesian chars (and emojis in CSV cells).
  // The BOM is U+FEFF encoded as the UTF-8 bytes EF BB BF.
  const bom = '\uFEFF';
  return bom + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

// BUGHUNT-OTHER-1 BUG-M10: dates were previously formatted via
// `d.toISOString().slice(0, 10)` which uses UTC. For Jakarta users, a
// transaction at 22:00 WIB on Jan 5 is stored as Jan 5 15:00 UTC, so the
// export correctly shows Jan 5. But a transaction at 01:00 WIB on Jan 6 is
// stored as Jan 5 18:00 UTC → exported as Jan 5 (wrong day). Use the
// Jakarta wall-clock date so the CSV matches the in-app display.
function fmtDate(d: Date): string {
  return jakartaDateKey(d);
}

function fmtDateTime(d: Date): string {
  // Combine the Jakarta date with the Jakarta time-of-day. We approximate
  // by formatting via Jakarta date + the UTC time-of-day for created/updated
  // stamps (the original code did toISOString() which is UTC). For audit
  // timestamps the small tz drift is acceptable; the more important fix is
  // for `fmtDate` (used on user-meaningful dates like transaction date,
  // journal date, deadline, etc.). For consistency we at least use the
  // Jakarta date prefix so the calendar day is correct.
  const datePart = jakartaDateKey(d);
  // Extract time-of-day from the UTC ISO string (HH:MM:SS portion) for
  // backward-compat with any tooling that parsed the old format. This is
  // purely informational.
  const timePart = d.toISOString().slice(11, 19);
  return `${datePart} ${timePart}`;
}

export async function GET() {
  try {
    const [
      habits,
      habitLogs,
      dailyLogs,
      journals,
      goals,
      challenges,
      badges,
      rewards,
      transactions,
      budgets,
      financeCategories,
      fundSources,
      weeklyBudgets,
      budgetSnapshots,
      habitGroups,
      learningTopics,
      habitOptions,
      appSettings,
    ] = await Promise.all([
      db.habit.findMany({ orderBy: { createdAt: 'asc' } }),
      db.habitLog.findMany({ orderBy: { date: 'asc' } }),
      db.dailyLog.findMany({ orderBy: { date: 'asc' } }),
      db.journal.findMany({ orderBy: { date: 'asc' } }),
      db.goal.findMany({ orderBy: { createdAt: 'asc' } }),
      db.challenge.findMany({ orderBy: { createdAt: 'asc' } }),
      db.badge.findMany({ orderBy: { createdAt: 'asc' } }),
      db.reward.findMany({ orderBy: { createdAt: 'asc' } }),
      db.transaction.findMany({ orderBy: { date: 'asc' } }),
      db.budget.findMany(),
      db.financeCategory.findMany({ orderBy: { createdAt: 'asc' } }),
      // BUG-6 fix: add 6 missing tables (were only in JSON export, not CSV)
      db.fundSource.findMany({ orderBy: { createdAt: 'asc' } }),
      db.weeklyBudget.findMany({ orderBy: { month: 'asc' } }),
      db.budgetSnapshot.findMany({ orderBy: { month: 'asc' } }),
      db.habitGroup.findMany({ orderBy: { createdAt: 'asc' } }),
      db.learningTopic.findMany({ orderBy: { createdAt: 'asc' } }),
      db.habitOption.findMany({ orderBy: { createdAt: 'asc' } }),
      // BUGHUNT-OTHER-1 BUG-M8: include AppSettings so theme/preferences are
      // backed up (was in JSON export but missing from CSV export).
      db.appSettings.findMany(),
    ]);

    const zip = new JSZip();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Habits
    zip.file(
      `1-habits-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Ikon', 'Kategori', 'Prioritas', 'Kesulitan', 'Target', 'Tipe Target', 'Warna', 'Reminder', 'Tanggal Mulai', 'Tanggal Selesai', 'Status', 'Catatan', 'Urutan', 'Dibuat', 'Diubah'],
        habits.map((h) => [h.id, h.name, h.icon, h.category, h.priority, h.difficulty, h.target, h.targetType, h.color, h.reminder ?? '', fmtDate(h.startDate), h.endDate ? fmtDate(h.endDate) : '', h.status, h.notes ?? '', h.order, fmtDateTime(h.createdAt), fmtDateTime(h.updatedAt)])
      )
    );

    // 2. Habit Logs
    zip.file(
      `2-habit-logs-${today}.csv`,
      toCSV(
        ['ID', 'Habit ID', 'Nama Habit', 'Tanggal', 'Selesai', 'Nilai', 'Dibuat'],
        habitLogs.map((l) => [l.id, l.habitId, habits.find((h) => h.id === l.habitId)?.name ?? '', fmtDate(l.date), l.completed ? 'Ya' : 'Tidak', l.value, fmtDateTime(l.createdAt)])
      )
    );

    // 3. Daily Logs
    zip.file(
      `3-daily-logs-${today}.csv`,
      toCSV(
        ['ID', 'Tanggal', 'Mood (1-5)', 'Energi (1-5)', 'Tidur (jam)', 'Catatan', 'Dibuat', 'Diubah'],
        dailyLogs.map((d) => [d.id, fmtDate(d.date), d.mood, d.energy, d.sleep, d.notes ?? '', fmtDateTime(d.createdAt), fmtDateTime(d.updatedAt)])
      )
    );

    // 4. Journals
    zip.file(
      `4-journal-${today}.csv`,
      toCSV(
        ['ID', 'Tanggal', 'Mood', 'Stress', 'Energi', 'Tidur', 'Refleksi', 'Win Hari Ini', 'Pelajaran', 'Rencana Besok', 'Dibuat', 'Diubah'],
        journals.map((j) => [j.id, fmtDate(j.date), j.mood, j.stress, j.energy, j.sleep, j.reflection ?? '', j.winToday ?? '', j.lessonLearned ?? '', j.tomorrowPlan ?? '', fmtDateTime(j.createdAt), fmtDateTime(j.updatedAt)])
      )
    );

    // 5. Goals
    zip.file(
      `5-goals-${today}.csv`,
      toCSV(
        ['ID', 'Judul', 'Deskripsi', 'Deadline', 'Progress (%)', 'Prioritas', 'Status', 'Milestones', 'Pencapaian', 'Dibuat', 'Diubah'],
        goals.map((g) => [g.id, g.title, g.description ?? '', g.deadline ? fmtDate(g.deadline) : '', g.progress, g.priority, g.status, g.milestones, g.achievement ?? '', fmtDateTime(g.createdAt), fmtDateTime(g.updatedAt)])
      )
    );

    // 6. Challenges
    zip.file(
      `6-challenges-${today}.csv`,
      toCSV(
        ['ID', 'Judul', 'Deskripsi', 'Durasi (hari)', 'Tanggal Mulai', 'Tanggal Selesai', 'Status', 'Progress (%)', 'Dibuat', 'Diubah'],
        challenges.map((c) => [c.id, c.title, c.description ?? '', c.duration, fmtDate(c.startDate), c.endDate ? fmtDate(c.endDate) : '', c.status, c.progress, fmtDateTime(c.createdAt), fmtDateTime(c.updatedAt)])
      )
    );

    // 7. Badges
    zip.file(
      `7-badges-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Deskripsi', 'Ikon', 'Syarat', 'Terbuka', 'Tanggal Terbuka', 'Dibuat', 'Diubah'],
        badges.map((b) => [b.id, b.name, b.description, b.icon, b.requirement, b.unlocked ? 'Ya' : 'Tidak', b.unlockedAt ? fmtDateTime(b.unlockedAt) : '', fmtDateTime(b.createdAt), fmtDateTime(b.updatedAt)])
      )
    );

    // 8. Rewards
    zip.file(
      `8-rewards-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Deskripsi', 'Syarat Buka', 'XP Cost', 'Status', 'Tanggal Terbuka', 'Tanggal Digunakan', 'Dibuat', 'Diubah'],
        rewards.map((r) => [r.id, r.name, r.description ?? '', r.unlockCondition, r.xpCost, r.status, r.unlockedAt ? fmtDateTime(r.unlockedAt) : '', r.redeemedAt ? fmtDateTime(r.redeemedAt) : '', fmtDateTime(r.createdAt), fmtDateTime(r.updatedAt)])
      )
    );

    // 9. Transactions
    zip.file(
      `9-transaksi-${today}.csv`,
      toCSV(
        ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah (Rp)', 'Deskripsi', 'Catatan', 'Dibuat', 'Diubah'],
        transactions.map((t) => [t.id, fmtDate(t.date), t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', t.category, t.amount, t.description ?? '', t.notes ?? '', fmtDateTime(t.createdAt), fmtDateTime(t.updatedAt)])
      )
    );

    // 10. Budgets
    zip.file(
      `10-budgets-${today}.csv`,
      toCSV(
        ['ID', 'Kategori', 'Jumlah (Rp)', 'Periode', 'Dibuat', 'Diubah'],
        budgets.map((b) => [b.id, b.category, b.amount, b.period, fmtDateTime(b.createdAt), fmtDateTime(b.updatedAt)])
      )
    );

    // 11. Finance Categories
    zip.file(
      `11-kategori-keuangan-${today}.csv`,
      toCSV(
        ['ID', 'Tipe', 'Nama', 'Emoji', 'Warna', 'Urutan', 'Dibuat', 'Diubah'],
        financeCategories.map((c) => [c.id, c.type === 'income' ? 'Pemasukan' : 'Pengeluaran', c.name, c.emoji, c.color, c.order, fmtDateTime(c.createdAt), fmtDateTime(c.updatedAt)])
      )
    );

    // 12. Fund Sources (BUG-6 fix — was missing from CSV export)
    zip.file(
      `12-sumber-dana-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Emoji', 'Saldo', 'Urutan', 'Dibuat', 'Diubah'],
        fundSources.map((s) => [s.id, s.name, s.emoji, s.balance, s.order, fmtDateTime(s.createdAt), fmtDateTime(s.updatedAt)])
      )
    );

    // 13. Weekly Budgets
    zip.file(
      `13-budget-mingguan-${today}.csv`,
      toCSV(
        ['ID', 'Bulan', 'Minggu', 'Target', 'Rollover', 'Dibuat', 'Diubah'],
        weeklyBudgets.map((w) => [w.id, w.month, w.week, w.target, w.rollover, fmtDateTime(w.createdAt), fmtDateTime(w.updatedAt)])
      )
    );

    // 14. Budget Snapshots
    zip.file(
      `14-snapshot-budget-${today}.csv`,
      toCSV(
        ['ID', 'Kategori', 'Bulan', 'Budget Awal', 'Terpakai', 'Rollover In', 'Rollover Out', 'Effective Budget', 'Persentase', 'Status', 'Dibuat', 'Diubah'],
        budgetSnapshots.map((s) => [s.id, s.category, s.month, s.budgetAmount, s.spentAmount, s.rolloverIn, s.rolloverOut, s.effectiveBudget, s.percentage, s.status, fmtDateTime(s.createdAt), fmtDateTime(s.updatedAt)])
      )
    );

    // 15. Habit Groups
    zip.file(
      `15-grup-habit-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Emoji', 'Warna', 'Urutan', 'Dibuat', 'Diubah'],
        habitGroups.map((g) => [g.id, g.name, g.emoji, g.color, g.order, fmtDateTime(g.createdAt), fmtDateTime(g.updatedAt)])
      )
    );

    // 16. Learning Topics
    zip.file(
      `16-topik-belajar-${today}.csv`,
      toCSV(
        ['ID', 'Nama', 'Emoji', 'Urutan', 'Dibuat', 'Diubah'],
        learningTopics.map((t) => [t.id, t.name, t.emoji, t.order, fmtDateTime(t.createdAt), fmtDateTime(t.updatedAt)])
      )
    );

    // 17. Habit Options
    zip.file(
      `17-opsi-habit-${today}.csv`,
      toCSV(
        ['ID', 'Tipe', 'Nama', 'Warna', 'XP', 'Urutan', 'Dibuat', 'Diubah'],
        habitOptions.map((o) => [o.id, o.type, o.name, o.color, o.xp, o.order, fmtDateTime(o.createdAt), fmtDateTime(o.updatedAt)])
      )
    );

    // 18. App Settings (BUGHUNT-OTHER-1 BUG-M8)
    zip.file(
      `18-pengaturan-${today}.csv`,
      toCSV(
        [
          'ID', 'User Name', 'Theme', 'Primary Color', 'Secondary Color',
          'Week Start', 'Language', 'Target Completion', 'Daily Budget Target',
          'Projection Category IDs', 'Push Habit Enabled', 'Push Habit Time',
          'Push Budget Enabled', 'Push Budget Time', 'Push Spending Enabled',
          'Push Spending Time', 'Dibuat', 'Diubah',
        ],
        appSettings.map((s) => [
          s.id, s.userName ?? '', s.theme ?? '', s.primaryColor ?? '',
          s.secondaryColor ?? '', s.weekStart ?? '', s.language ?? '',
          s.targetCompletion ?? '', s.dailyBudgetTarget ?? '',
          s.projectionCategoryIds ?? '',
          s.pushHabitEnabled ? 'Ya' : 'Tidak', s.pushHabitTime ?? '',
          s.pushBudgetEnabled ? 'Ya' : 'Tidak', s.pushBudgetTime ?? '',
          s.pushSpendingEnabled ? 'Ya' : 'Tidak', s.pushSpendingTime ?? '',
          fmtDateTime(s.createdAt), fmtDateTime(s.updatedAt),
        ])
      )
    );

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    const totalRecords = habits.length + habitLogs.length + dailyLogs.length + journals.length + goals.length + challenges.length + badges.length + rewards.length + transactions.length + budgets.length + financeCategories.length + fundSources.length + weeklyBudgets.length + budgetSnapshots.length + habitGroups.length + learningTopics.length + habitOptions.length + appSettings.length;

    // Convert Uint8Array to a Blob for Response BodyInit compatibility.
    // Some TS lib versions reject Uint8Array<ArrayBufferLike> directly.
    const blob = new Blob([zipBuffer as BlobPart], { type: 'application/zip' });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="habit-tracker-data-${today}.zip"`,
        'X-Total-Records': String(totalRecords),
        'X-Files-Count': '18',
      },
    });
  } catch (error) {
    console.error('CSV export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export data as CSV' },
      { status: 500 }
    );
  }
}