// Seed data uji Meja Kerja LOKAL — reproduksi E2E Fase 2 di sandbox.
// Jalankan: bun scripts/seed-work-test.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const db = new PrismaClient({
  adapter: new PrismaLibSQL({ url: 'file:/home/z/my-project/db/custom.db' }),
});

const today = new Date();
const ymd = (offsetDays = 0) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const ymdDate = (offsetDays = 0) => new Date(`${ymd(offsetDays)}T00:00:00.000Z`);

async function main() {
  await db.workRoutineLog.deleteMany();
  await db.workRoutine.deleteMany();
  await db.workTask.deleteMany();
  await db.workNote.deleteMany();
  await db.workDayFlag.deleteMany();

  // Rutinitas
  const routines = [
    { title: 'Cek email & chat kantor', timeOfDay: 'pagi' },
    { title: 'Susun 3 prioritas hari ini', timeOfDay: 'pagi' },
    { title: 'Review task tim (standup)', timeOfDay: 'pagi' },
    { title: 'Deep work: proyek utama', timeOfDay: 'siang' },
    { title: 'Balas invoice & admin', timeOfDay: 'siang' },
    { title: 'Rapikan meja + catat esok', timeOfDay: 'sore' },
    { title: 'Backup file kerjaan', timeOfDay: 'sore' },
  ];
  for (let i = 0; i < routines.length; i++) {
    const r = routines[i];
    await db.workRoutine.create({
      data: { title: r.title, timeOfDay: r.timeOfDay, sortOrder: i, active: true },
    });
  }

  // Tugas: campuran status
  const tasks = [
    { title: 'Kirim invoice klien PT Maju', status: 'todo', day: 0 },
    { title: 'Review konten landing page', status: 'todo', day: 0 },
    { title: 'Jadwalkan meeting dengan vendor', status: 'jalan', day: 0 },
    { title: 'Tunggu balasan HRD rekrutmen', status: 'nunggu', day: 0 },
    { title: 'Revisi proposal proyek alpha', status: 'todo', day: -1 }, // overdue
    { title: 'Follow up tawaran kerjasama', status: 'nunggu', day: -2 }, // overdue nunggu
    { title: 'Ide konten bulan depan', status: 'todo', day: null }, // kapan saja
    { title: 'Belajar tool analitik baru', status: 'todo', day: null },
    { title: 'Presentasi kuartalan', status: 'todo', day: 3 }, // future
    { title: 'Serah terima dokumen pajak', status: 'jalan', day: 0 },
  ];
  const created: { id: string }[] = [];
  for (const t of tasks) {
    created.push(
      await db.workTask.create({
        data: {
          title: t.title,
          status: t.status,
          dayKey: t.day === null ? null : ymd(t.day),
          notes: t.title.includes('invoice') ? 'jatuh tempo akhir bulan' : null,
        },
      })
    );
  }

  // Selesai hari ini (kolom Selesai)
  await db.workTask.create({
    data: {
      title: 'Kirim laporan mingguan',
      status: 'selesai',
      dayKey: ymd(0),
      completedAt: new Date(),
    },
  });
  // Arsip: selesai dari hari-hari lalu
  for (const [title, day] of [
    ['Rapikan folder proyek lama', -1],
    ['Bayar tagihan kantor', -2],
    ['Onboarding rekan baru', -3],
  ] as [string, number][]) {
    await db.workTask.create({
      data: {
        title,
        status: 'selesai',
        dayKey: ymd(day),
        completedAt: ymdDate(day),
      },
    });
  }

  // Catatan
  await db.workNote.createMany({
    data: [
      { content: 'Klien minta revisi logo — kirim ulang Senin', tag: 'proyek', pinned: true },
      { content: 'Ide: automation laporan mingguan pakai spreadsheet', tag: 'ide' },
      { content: 'Password wifi meeting room barunya di whiteboard', tag: 'admin' },
    ],
  });

  console.log(
    'Seeded:',
    routines.length,
    'routines,',
    created.length + 4,
    'tasks (incl selesai+arsip), 3 notes'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
