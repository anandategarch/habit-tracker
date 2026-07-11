import { db } from '../src/lib/db';

const categories = [
  { name: 'Health', color: 'emerald', order: 1 },
  { name: 'Fitness', color: 'green', order: 2 },
  { name: 'Learning', color: 'amber', order: 3 },
  { name: 'Education', color: 'amber', order: 4 },
  { name: 'Productivity', color: 'orange', order: 5 },
  { name: 'Work', color: 'orange', order: 6 },
  { name: 'Mindfulness', color: 'teal', order: 7 },
  { name: 'Wellness', color: 'teal', order: 8 },
  { name: 'Social', color: 'pink', order: 9 },
  { name: 'Creative', color: 'fuchsia', order: 10 },
  { name: 'Financial', color: 'lime', order: 11 },
  { name: 'SelfCare', color: 'rose', order: 12 },
  { name: 'General', color: 'gray', order: 13 },
];

const priorities = [
  { name: 'High', color: 'red', order: 1 },
  { name: 'Medium', color: 'amber', order: 2 },
  { name: 'Low', color: 'green', order: 3 },
];

const difficulties = [
  { name: 'Easy', color: 'green', xp: 10, order: 1 },
  { name: 'Medium', color: 'amber', xp: 20, order: 2 },
  { name: 'Hard', color: 'red', xp: 30, order: 3 },
  { name: 'Expert', color: 'purple', xp: 50, order: 4 },
];

async function seed() {
  console.log('Seeding habit options (idempotent)...');

  const allOptions = [
    ...categories.map((c) => ({ ...c, type: 'category' as const, xp: 0 })),
    ...priorities.map((p) => ({ ...p, type: 'priority' as const, xp: 0 })),
    ...difficulties.map((d) => ({ ...d, type: 'difficulty' as const })),
  ];

  let created = 0;
  let skipped = 0;

  for (const opt of allOptions) {
    const existing = await db.habitOption.findUnique({
      where: { type_name: { type: opt.type, name: opt.name } },
    });

    if (existing) {
      skipped++;
      console.log(`  SKIP: ${opt.type}/${opt.name} already exists`);
    } else {
      await db.habitOption.create({
        data: {
          type: opt.type,
          name: opt.name,
          color: opt.color,
          xp: opt.xp,
          order: opt.order,
        },
      });
      created++;
      console.log(`  CREATED: ${opt.type}/${opt.name}`);
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });