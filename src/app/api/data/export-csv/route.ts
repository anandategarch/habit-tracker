import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';

function esc(field: string | number | boolean | null | undefined): string {
  const s = field === null || field === undefined ? '' : String(field);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
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

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    const totalRecords = habits.length + habitLogs.length + dailyLogs.length + journals.length + goals.length + challenges.length + badges.length + rewards.length + transactions.length + budgets.length + financeCategories.length;

    // Convert Uint8Array to a Blob for Response BodyInit compatibility.
    // Some TS lib versions reject Uint8Array<ArrayBufferLike> directly.
    const blob = new Blob([zipBuffer as BlobPart], { type: 'application/zip' });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="habit-tracker-data-${today}.zip"`,
        'X-Total-Records': String(totalRecords),
        'X-Files-Count': '11',
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