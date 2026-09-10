// Seed data uji LOKAL (file db/custom.db) — hanya untuk reproduksi bug layout
// di sandbox. Tidak menyentuh Turso produksi. Jalankan: bun scripts/seed-local-test.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const db = new PrismaClient({
  adapter: new PrismaLibSQL({ url: 'file:/home/z/my-project/db/custom.db' }),
});

const today = new Date();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ymdDate = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);

async function main() {
  // Bersihkan data uji lama
  await db.habitLog.deleteMany();
  await db.habit.deleteMany();

  const defs = [
    { name: 'Daily Learning', emoji: '📚', category: 'Belajar', habitType: 'binary' },
    { name: 'Bangun-Pagi', emoji: '🌅', category: 'Pagi', habitType: 'binary' },
    { name: 'Membaca', emoji: '📖', category: 'Belajar', habitType: 'binary' },
    { name: 'Jalan', emoji: '🚶', category: 'Sehat', habitType: 'amount', target: 5, unit: 'km' },
    { name: 'Memasak', emoji: '🍳', category: 'Rumah', habitType: 'binary' },
    { name: 'Badminton', emoji: '🏸', category: 'Sehat', habitType: 'binary' },
    { name: 'Minum Air', emoji: '💧', category: 'Sehat', habitType: 'amount', target: 8, unit: 'gelas' },
    { name: 'Ngalirin Ide', emoji: '✍️', category: 'Kerja', habitType: 'binary' },
    { name: 'Tidur Cepat', emoji: '😴', category: 'Malam', habitType: 'binary' },
    { name: 'Stretching', emoji: '🧘', category: 'Sehat', habitType: 'binary' },
  ];

  const habits = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    habits.push(
      await db.habit.create({
        data: {
          name: d.name,
          emoji: d.emoji,
          category: d.category,
          habitType: d.habitType,
          target: d.target ?? 1,
          unit: d.unit ?? null,
          sortOrder: i,
          startDate: ymdDate(today),
        },
      })
    );
  }

  // Beberapa selesai hari ini (dengan jam) supaya ada kartu yang lebih tinggi
  const doneIdx = [1, 0, 3]; // Bangun-Pagi, Daily Learning, Jalan(amount penuh)
  for (const idx of doneIdx) {
    await db.habitLog.create({
      data: {
        habitId: habits[idx].id,
        date: new Date(`${ymd(today)}T00:00:00.000Z`),
        completed: true,
        completedAt: new Date(`${ymd(today)}T06:39:00.000Z`),
        value: habits[idx].target,
      },
    });
  }
  // Minum Air setengah jalan
  await db.habitLog.create({
    data: { habitId: habits[6].id, date: today, completed: false, value: 4 },
  });

  console.log('Seeded', habits.length, 'habits,', doneIdx.length + 1, 'logs');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
