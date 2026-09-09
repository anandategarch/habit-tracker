// Seed data Rutina — data demo realistis (bahasa Indonesia, zona Jakarta).
// Jalankan: bun scripts/seed.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const JST = 7 * 60; // offset Jakarta menit
function jakartaYmd(date = new Date()): string {
  const s = new Date(date.getTime() + JST * 60_000);
  return s.toISOString().slice(0, 10);
}
function ymdShift(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  return t.toISOString().slice(0, 10);
}
function midnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function noon(ymd: string, h = 12, min = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min));
}
function jakartaMidnightIso(ymd: string): Date {
  // tengah malam Jakarta (+07:00) sebagai Date: 17:00Z hari sebelumnya
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
}

async function main() {
  console.log('Menghapus data lama...');
  await db.habitLog.deleteMany();
  await db.dailyLog.deleteMany();
  await db.habit.deleteMany();
  await db.habitGroup.deleteMany();
  await db.habitOption.deleteMany();
  await db.transaction.deleteMany();
  await db.fundSource.deleteMany();
  await db.financeCategory.deleteMany();
  await db.weeklyBudget.deleteMany();
  await db.budgetSnapshot.deleteMany();
  await db.savingsGoal.deleteMany();
  await db.recurringTransaction.deleteMany();
  await db.transactionRule.deleteMany();
  await db.goal.deleteMany();

  await db.appSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', userName: 'User', theme: 'system', themeColor: 'teal', weekStart: 1, language: 'id', targetCompletion: 80 },
  });

  console.log('Seed habit options + groups...');
  const cats = [
    ['Kesehatan', '#14b8a6'], ['Produktivitas', '#8b5cf6'], ['Belajar', '#0ea5e9'],
    ['Kebiasaan', '#f59e0b'], ['Umum', '#64748b'], ['Pikiran', '#f43f5e'],
  ] as const;
  for (const [i, [label, color]] of cats.entries()) {
    await db.habitOption.create({ data: { type: 'category', label, color, sortOrder: i } });
  }
  for (const [i, label] of ['Rendah', 'Sedang', 'Tinggi'].entries()) {
    await db.habitOption.create({ data: { type: 'priority', label, sortOrder: i } });
  }
  for (const [i, label] of ['Mudah', 'Sedang', 'Sulit'].entries()) {
    await db.habitOption.create({ data: { type: 'difficulty', label, sortOrder: i } });
  }
  const morningGroup = await db.habitGroup.create({ data: { name: 'Pagi Hari', color: '#f59e0b', sortOrder: 0 } });
  const healthGroup = await db.habitGroup.create({ data: { name: 'Kesehatan', color: '#14b8a6', sortOrder: 1 } });

  console.log('Seed habits...');
  const habits = [
    { name: 'Meditasi Pagi', emoji: '🧘', category: 'Pikiran', priority: 'Sedang', difficulty: 'Mudah', habitType: 'normal', target: 1, trackTime: true, groupId: morningGroup.id, sortOrder: 0 },
    { name: 'Minum Air 8 Gelas', emoji: '💧', category: 'Kesehatan', priority: 'Sedang', difficulty: 'Mudah', habitType: 'amount', target: 8, unit: 'gelas', trackTime: false, groupId: healthGroup.id, sortOrder: 1 },
    { name: 'Baca Buku 30 Menit', emoji: '📚', category: 'Belajar', priority: 'Sedang', difficulty: 'Sedang', habitType: 'normal', target: 1, trackTime: true, groupId: null, sortOrder: 2 },
    { name: 'Olahraga', emoji: '🏃', category: 'Kesehatan', priority: 'Tinggi', difficulty: 'Sulit', habitType: 'normal', target: 1, trackTime: true, groupId: healthGroup.id, sortOrder: 3 },
    { name: 'Jurnal Malam', emoji: '📓', category: 'Kebiasaan', priority: 'Rendah', difficulty: 'Mudah', habitType: 'normal', target: 1, trackTime: false, groupId: null, sortOrder: 4 },
    { name: 'Tanpa Gula', emoji: '🚫', category: 'Kesehatan', priority: 'Sedang', difficulty: 'Sulit', habitType: 'avoid', target: 1, trackTime: false, groupId: null, sortOrder: 5 },
  ];
  const createdHabits: { id: string; name: string; habitType: string; target: number; difficulty: string }[] = [];
  for (const h of habits) {
    const row = await db.habit.create({ data: { ...h, startDate: midnight(ymdShift(jakartaYmd(), -60)) } });
    createdHabits.push({ id: row.id, name: row.name, habitType: row.habitType, target: row.target, difficulty: row.difficulty });
  }

  console.log('Seed habit logs 30 hari (pola realistis, streak aktif)...');
  const today = jakartaYmd();
  const pattern: Record<string, number> = {
    'Meditasi Pagi': 0.9,
    'Minum Air 8 Gelas': 0.75,
    'Baca Buku 30 Menit': 0.65,
    Olahraga: 0.5,
    'Jurnal Malam': 0.7,
    'Tanpa Gula': 0.6,
  };
  const XP_DIFF: Record<string, number> = { Mudah: 5, Sedang: 10, Sulit: 20 };
  let totalXp = 0;
  for (const h of createdHabits) {
    const prob = pattern[h.name] ?? 0.7;
    const streakTail = Math.random() < 0.8 ? Math.floor(Math.random() * 5) + 2 : 0; // hari terakhir berturut-turut
    for (let back = 29; back >= 0; back--) {
      const ymd = ymdShift(today, -back);
      const done = back < streakTail ? true : Math.random() < prob;
      if (!done) continue;
      const value = h.habitType === 'amount' ? Math.max(3, Math.round(h.target * (0.6 + Math.random() * 0.5))) : 1;
      const completedAt = new Date(noon(ymd, 6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60)).getTime() - 7 * 3_600_000);
      await db.habitLog.create({
        data: { habitId: h.id, date: midnight(ymd), completed: true, value, completedAt },
      });
      totalXp += XP_DIFF[h.difficulty] ?? 10;
    }
  }
  console.log(`  total XP potensial: ${totalXp}`);

  console.log('Seed daily logs (mood/energi/tidur + notes)...');
  const notesSamples = [
    'Hari yang produktif. Meditasi bantu fokus pagi.',
    'Agak lelah sore, tapi tetap jalan.',
    'Mood bagus setelah olahraga.',
    'Kontrol gula masih sulit pas ada rapat kantor.',
    '',
    'Baca 20 halaman buku Atomic Habits.',
    '',
    'Tidur cukup semalam, energi penuh.',
  ];
  for (let back = 13; back >= 0; back--) {
    const ymd = ymdShift(today, -back);
    await db.dailyLog.create({
      data: {
        date: midnight(ymd),
        mood: 3 + Math.round(Math.random() * 2),
        energy: 3 + Math.round(Math.random() * 1),
        sleep: 6 + Math.round(Math.random() * 2),
        notes: notesSamples[Math.floor(Math.random() * notesSamples.length)] || null,
      },
    });
  }

  console.log('Seed kategori keuangan...');
  const finCats = [
    ['Makanan & Minuman', '🍽️', '#f59e0b', 'expense'],
    ['Transportasi', '🚌', '#0ea5e9', 'expense'],
    ['Belanja', '🛍️', '#f43f5e', 'expense'],
    ['Hiburan', '🎬', '#8b5cf6', 'expense'],
    ['Tagihan', '🧾', '#64748b', 'expense'],
    ['Kesehatan', '💊', '#10b981', 'expense'],
    ['Gaji', '💰', '#10b981', 'income'],
    ['Freelance', '💼', '#0ea5e9', 'income'],
  ] as const;
  for (const [name, emoji, color, type] of finCats) {
    await db.financeCategory.create({ data: { name, emoji, color, type } });
  }

  console.log('Seed sumber dana...');
  const dompet = await db.fundSource.create({ data: { name: 'Dompet Tunai', emoji: '👛', type: 'cash', initialBalance: 500_000, sortOrder: 0 } });
  const bca = await db.fundSource.create({ data: { name: 'BCA', emoji: '🏦', type: 'bank', initialBalance: 15_000_000, sortOrder: 1 } });
  const gopay = await db.fundSource.create({ data: { name: 'GoPay', emoji: '📱', type: 'ewallet', initialBalance: 250_000, sortOrder: 2 } });

  console.log('Seed transaksi 45 hari...');
  const expenses: [string, string, number, number][] = [
    ['Makanan & Minuman', 'Makan siang warteg', 15_000, 35_000],
    ['Makanan & Minuman', 'Kopi', 18_000, 45_000],
    ['Transportasi', 'Ojek online', 12_000, 40_000],
    ['Transportasi', 'Isi bensin', 50_000, 100_000],
    ['Belanja', 'Belanja mingguan', 120_000, 400_000],
    ['Hiburan', 'Langganan streaming', 54_000, 54_000],
    ['Hiburan', 'Nonton bioskop', 40_000, 75_000],
    ['Tagihan', 'Listrik & internet', 350_000, 450_000],
    ['Kesehatan', 'Vitamin & suplemen', 60_000, 150_000],
  ];
  const rand = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) / 500) * 500;
  let expenseCount = 0;
  for (let back = 44; back >= 0; back--) {
    const ymd = ymdShift(today, -back);
    const dayOfMonth = Number(ymd.slice(8, 10));
    if (dayOfMonth === 1) {
      await db.transaction.create({ data: { type: 'income', amount: 8_500_000, category: 'Gaji', sourceId: bca.id, description: 'Gaji bulanan', date: noon(ymd, 9), tags: 'tetap' } });
    }
    if (dayOfMonth === 5 && Math.random() < 0.8) {
      await db.transaction.create({ data: { type: 'income', amount: rand(1_200_000, 3_500_000), category: 'Freelance', sourceId: bca.id, description: 'Proyek freelance desain', date: noon(ymd, 15), tags: 'side-hustle' } });
    }
    const dayTotal = Math.random() < 0.85 ? 1 + Math.floor(Math.random() * 3) : 0;
    for (let i = 0; i < dayTotal; i++) {
      const [cat, desc, min, max] = expenses[Math.floor(Math.random() * expenses.length)];
      const source = [dompet, bca, gopay][Math.floor(Math.random() * 3)];
      const tagPool = ['rutin', 'junk-food', 'hemat', ''];
      await db.transaction.create({
        data: {
          type: 'expense',
          amount: rand(min, max),
          category: cat,
          sourceId: source.id,
          description: desc,
          notes: null,
          tags: tagPool[Math.floor(Math.random() * tagPool.length)],
          date: noon(ymd, 8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60)),
        },
      });
      expenseCount++;
    }
  }
  console.log(`  ${expenseCount} pengeluaran dibuat`);

  console.log('Seed transfer pasangan + budget + tabungan + recurring + rules...');
  const ymd10 = ymdShift(today, -10);
  const trOut = await db.transaction.create({ data: { type: 'transfer', amount: 500_000, category: 'Transfer', sourceId: bca.id, description: 'Tarik tunai ATM', date: noon(ymd10, 10) } });
  await db.transaction.create({ data: { type: 'transfer', amount: 500_000, category: 'Transfer', sourceId: dompet.id, description: 'Tarik tunai ATM', date: noon(ymd10, 10), transferPairId: trOut.id } });

  const thisMonth = today.slice(0, 7);
  for (const [cat, amount] of [['Makanan & Minuman', 2_500_000], ['Transportasi', 800_000], ['Belanja', 1_200_000], ['Hiburan', 500_000]] as const) {
    await db.weeklyBudget.create({ data: { category: cat, month: thisMonth, amount } });
  }

  await db.savingsGoal.create({ data: { name: 'Liburan Bali', emoji: '🏝️', targetAmount: 5_000_000, currentAmount: 3_250_000, deadline: jakartaMidnightIso(ymdShift(today, 90)) } });
  await db.savingsGoal.create({ data: { name: 'Dana Darurat', emoji: '🛡️', targetAmount: 20_000_000, currentAmount: 8_000_000, deadline: null } });
  await db.savingsGoal.create({ data: { name: 'Laptop Baru', emoji: '💻', targetAmount: 15_000_000, currentAmount: 15_000_000, deadline: jakartaMidnightIso(ymdShift(today, -5)), completedAt: jakartaMidnightIso(ymdShift(today, -5)) } });

  await db.recurringTransaction.create({ data: { name: 'Sewa kos', amount: 1_200_000, type: 'expense', category: 'Tagihan', sourceId: bca.id, frequency: 'monthly', startDate: jakartaMidnightIso(ymdShift(today, -60)), lastRun: jakartaMidnightIso(ymdShift(today, -30)), isActive: true } });
  await db.recurringTransaction.create({ data: { name: 'Langganan internet', amount: 350_000, type: 'expense', category: 'Tagihan', sourceId: bca.id, frequency: 'monthly', startDate: jakartaMidnightIso(ymdShift(today, -60)), lastRun: null, isActive: true } });

  await db.transactionRule.create({ data: { keyword: 'warteg', category: 'Makanan & Minuman', sourceId: dompet.id, priority: 10 } });
  await db.transactionRule.create({ data: { keyword: 'ojek', category: 'Transportasi', sourceId: gopay.id, priority: 8 } });
  await db.transactionRule.create({ data: { keyword: 'gaji', category: 'Gaji', sourceId: bca.id, priority: 10 } });

  console.log('Seed goals + milestones...');
  const goalMilestones = JSON.stringify([
    { text: 'Selesaikan 6 buku non-fiction', done: true },
    { text: 'Rata-rata 1 buku/bulan', done: false },
  ]);
  await db.goal.create({ data: { title: 'Baca 12 buku tahun ini', description: 'Target membaca pribadi untuk tahun ini.', priority: 'Sedang', status: 'active', deadline: `${today.slice(0, 4)}-12-31`, milestones: goalMilestones } });
  const fitMilestones = JSON.stringify([
    { text: 'Punya jadwal gym tetap', done: true },
    { text: 'Naikkan beban squat ke 60kg', done: false },
    { text: 'Ikut lari 10K', done: false },
  ]);
  await db.goal.create({ data: { title: 'Rutinitas gym 3x seminggu', description: null, priority: 'Tinggi', status: 'active', deadline: ymdShift(today, 60), milestones: fitMilestones } });
  const doneMilestones = JSON.stringify([{ text: 'Menabung 50% target', done: true }]);
  await db.goal.create({ data: { title: 'Bangun dana darurat', description: 'Dana darurat 6 bulan pengeluaran.', priority: 'Tinggi', status: 'completed', deadline: ymdShift(today, -10), milestones: doneMilestones } });

  console.log('Seed selesai ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
