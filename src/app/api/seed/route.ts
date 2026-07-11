import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Seed default badges
const DEFAULT_BADGES = [
  { name: 'First Step', description: 'Complete your first habit', icon: '🌱', requirement: 'Complete 1 habit' },
  { name: 'Week Warrior', description: '7-day streak', icon: '🔥', requirement: '7-day streak' },
  { name: 'Habit Master', description: '30-day streak', icon: '⚡', requirement: '30-day streak' },
  { name: 'Centurion', description: '100 total completions', icon: '💯', requirement: '100 completions' },
  { name: 'Perfectionist', description: '100% completion for a week', icon: '🎯', requirement: '100% for 7 days' },
  { name: 'Early Bird', description: 'Track 30 days', icon: '🐦', requirement: '30 days tracked' },
  { name: 'Journal Keeper', description: 'Write 10 journal entries', icon: '📝', requirement: '10 journals' },
  { name: 'Goal Setter', description: 'Create your first goal', icon: '🏆', requirement: '1 goal created' },
  { name: 'Level 5', description: 'Reach level 5', icon: '⭐', requirement: 'Reach level 5' },
  { name: 'Level 10', description: 'Reach level 10', icon: '🌟', requirement: 'Reach level 10' },
  { name: 'XP Hunter', description: 'Earn 1000 XP', icon: '💎', requirement: '1000 XP earned' },
  { name: 'Challenge Accepted', description: 'Complete a challenge', icon: '🚀', requirement: '1 challenge completed' },
];

const DEFAULT_REWARDS = [
  { name: 'Movie Night', unlockCondition: 'Reach Level 3', xpCost: 500, description: 'Treat yourself to a movie' },
  { name: 'Gaming Session', unlockCondition: 'Reach Level 5', xpCost: 1000, description: '2 hours of gaming' },
  { name: 'Special Meal', unlockCondition: 'Earn 2000 XP', xpCost: 2000, description: 'Order your favorite food' },
  { name: 'Day Off', unlockCondition: 'Complete 30-day challenge', xpCost: 3000, description: 'Take a full day off' },
  { name: 'Shopping Spree', unlockCondition: 'Reach Level 10', xpCost: 5000, description: 'Buy something nice' },
];

// Seed finance sample data
const SAMPLE_TRANSACTIONS = (() => {
  const now = new Date();
  const txs: { type: string; amount: number; category: string; description: string; date: Date; notes: string | null }[] = [];

  // Generate 3 months of data
  for (let m = 2; m >= 0; m--) {
    const year = new Date(now.getFullYear(), now.getMonth() - m, 1).getFullYear();
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1).getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const maxDay = m === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

    // Income
    txs.push({ type: 'income', amount: 8000000, category: 'Gaji', description: 'Gaji bulanan', date: new Date(year, month, 1), notes: null });
    if (m === 0) {
      txs.push({ type: 'income', amount: 2500000, category: 'Freelance', description: 'Project website klien', date: new Date(year, month, 5), notes: 'DP 50%' });
      txs.push({ type: 'income', amount: 350000, category: 'Investasi', description: 'Dividen saham BBCA', date: new Date(year, month, 10), notes: null });
    }
    if (m === 1) {
      txs.push({ type: 'income', amount: 1500000, category: 'Freelance', description: 'Desain logo', date: new Date(year, month, 12), notes: null });
    }
    if (m === 2) {
      txs.push({ type: 'income', amount: 500000, category: 'Investasi', description: 'Bunga deposito', date: new Date(year, month, 15), notes: null });
    }

    // Daily expenses
    for (let d = 1; d <= maxDay; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();

      // Makanan (most days)
      if (d % 2 === 0) {
        txs.push({ type: 'expense', amount: 25000 + Math.round(Math.random() * 25000), category: 'Makanan & Minuman', description: 'Makan siang', date, notes: null });
      }
      if (dayOfWeek === 5) {
        txs.push({ type: 'expense', amount: 50000 + Math.round(Math.random() * 50000), category: 'Makanan & Minuman', description: 'Jajan weekend', date, notes: null });
      }

      // Transportasi
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && d % 3 === 0) {
        txs.push({ type: 'expense', amount: 10000 + Math.round(Math.random() * 15000), category: 'Transportasi', description: 'Ojol ke kantor', date, notes: null });
      }

      // Belanja (occasional)
      if (d % 10 === 3) {
        txs.push({ type: 'expense', amount: 75000 + Math.round(Math.random() * 200000), category: 'Belanja', description: 'Belanja kebutuhan', date, notes: null });
      }

      // Hiburan
      if (d % 14 === 7) {
        txs.push({ type: 'expense', amount: 30000 + Math.round(Math.random() * 70000), category: 'Hiburan', description: 'Nonton film / langganan', date, notes: null });
      }

      // Tagihan (monthly)
      if (d === 5) {
        txs.push({ type: 'expense', amount: 350000, category: 'Tagihan & Utilitas', description: 'Listrik & internet', date, notes: null });
        txs.push({ type: 'expense', amount: 150000, category: 'Tagihan & Utilitas', description: 'Pulsa & paket data', date, notes: null });
      }
      if (d === 10) {
        txs.push({ type: 'expense', amount: 500000, category: 'Tabungan & Investasi', description: 'Setor rekening tabungan', date, notes: 'Auto debet' });
      }
      if (d === 15 && m === 0) {
        txs.push({ type: 'expense', amount: 250000, category: 'Kesehatan', description: 'Obat & vitamin', date, notes: null });
      }
      if (d === 20 && m === 1) {
        txs.push({ type: 'expense', amount: 350000, category: 'Pendidikan', description: 'Beli buku & kursus online', date, notes: null });
      }
    }
  }
  return txs;
})();

const SAMPLE_BUDGETS = [
  { category: 'Makanan & Minuman', amount: 2000000, period: 'monthly' },
  { category: 'Transportasi', amount: 800000, period: 'monthly' },
  { category: 'Belanja', amount: 1000000, period: 'monthly' },
  { category: 'Hiburan', amount: 500000, period: 'monthly' },
  { category: 'Tagihan & Utilitas', amount: 600000, period: 'monthly' },
  { category: 'Kesehatan', amount: 300000, period: 'monthly' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { type: 'expense', name: 'Makanan & Minuman', emoji: '🍽️', color: '#ef4444', order: 1 },
  { type: 'expense', name: 'Transportasi', emoji: '🚗', color: '#f97316', order: 2 },
  { type: 'expense', name: 'Belanja', emoji: '🛍️', color: '#eab308', order: 3 },
  { type: 'expense', name: 'Hiburan', emoji: '🎮', color: '#a855f7', order: 4 },
  { type: 'expense', name: 'Kesehatan', emoji: '🏥', color: '#ec4899', order: 5 },
  { type: 'expense', name: 'Pendidikan', emoji: '📚', color: '#3b82f6', order: 6 },
  { type: 'expense', name: 'Tagihan & Utilitas', emoji: '📋', color: '#6366f1', order: 7 },
  { type: 'expense', name: 'Tabungan & Investasi', emoji: '🏦', color: '#14b8a6', order: 8 },
  { type: 'expense', name: 'Lainnya', emoji: '📦', color: '#78716c', order: 9 },
];

const DEFAULT_LEARNING_TOPICS = [
  { name: 'Akuntansi', emoji: '📒', order: 0 },
  { name: 'Keuangan', emoji: '💰', order: 1 },
  { name: 'Ekonomi', emoji: '📈', order: 2 },
  { name: 'Pajak', emoji: '🧾', order: 3 },
  { name: 'Investasi', emoji: '🏦', order: 4 },
  { name: 'Manajemen', emoji: '📊', order: 5 },
];

const DEFAULT_HABIT_CATEGORIES = [
  { type: 'category', name: 'General', color: 'slate', xp: 0, order: 0 },
  { type: 'category', name: 'Health', color: 'emerald', xp: 0, order: 1 },
  { type: 'category', name: 'Fitness', color: 'orange', xp: 0, order: 2 },
  { type: 'category', name: 'Learning', color: 'blue', xp: 0, order: 3 },
  { type: 'category', name: 'Mindfulness', color: 'violet', xp: 0, order: 4 },
  { type: 'category', name: 'Productivity', color: 'amber', xp: 0, order: 5 },
  { type: 'category', name: 'Social', color: 'pink', xp: 0, order: 6 },
  { type: 'category', name: 'Creative', color: 'fuchsia', xp: 0, order: 7 },
];

const DEFAULT_HABIT_PRIORITIES = [
  { type: 'priority', name: 'Low', color: 'green', xp: 0, order: 0 },
  { type: 'priority', name: 'Medium', color: 'amber', xp: 0, order: 1 },
  { type: 'priority', name: 'High', color: 'red', xp: 0, order: 2 },
];

const DEFAULT_HABIT_DIFFICULTIES = [
  { type: 'difficulty', name: 'Easy', color: 'green', xp: 10, order: 0 },
  { type: 'difficulty', name: 'Medium', color: 'amber', xp: 20, order: 1 },
  { type: 'difficulty', name: 'Hard', color: 'red', xp: 40, order: 2 },
];

const DEFAULT_INCOME_CATEGORIES = [
  { type: 'income', name: 'Gaji', emoji: '💰', color: '#22c55e', order: 1 },
  { type: 'income', name: 'Freelance', emoji: '💻', color: '#06b6d4', order: 2 },
  { type: 'income', name: 'Investasi', emoji: '📈', color: '#f59e0b', order: 3 },
  { type: 'income', name: 'Bisnis', emoji: '🏢', color: '#8b5cf6', order: 4 },
  { type: 'income', name: 'Lainnya', emoji: '💸', color: '#78716c', order: 5 },
];

export async function GET() {
  try {
    const badgeCount = await db.badge.count();
    const rewardCount = await db.reward.count();
    const txCount = await db.transaction.count();
    const budgetCount = await db.budget.count();
    const catCount = await db.financeCategory.count();

    if (badgeCount === 0) {
      await db.badge.createMany({ data: DEFAULT_BADGES });
    }
    if (rewardCount === 0) {
      await db.reward.createMany({ data: DEFAULT_REWARDS });
    }

    // Default settings
    const settingsCount = await db.appSettings.count();
    if (settingsCount === 0) {
      await db.appSettings.create({ data: {} });
    }

    if (budgetCount === 0) {
      await db.budget.createMany({ data: SAMPLE_BUDGETS });
    }
    if (txCount === 0) {
      await db.transaction.createMany({ data: SAMPLE_TRANSACTIONS });
    }

    if (catCount === 0) {
      await db.financeCategory.createMany({ data: [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES] });
    }

    // Default learning topics
    const topicCount = await db.learningTopic.count();
    if (topicCount === 0) {
      await db.learningTopic.createMany({ data: DEFAULT_LEARNING_TOPICS });
    }

    // Default habit options (categories, priorities, difficulties)
    // Wrap in try/catch in case HabitOption table doesn't exist yet
    let habitOptionCount = 0;
    try {
      habitOptionCount = await db.habitOption.count();
      if (habitOptionCount === 0) {
        await db.habitOption.createMany({
          data: [...DEFAULT_HABIT_CATEGORIES, ...DEFAULT_HABIT_PRIORITIES, ...DEFAULT_HABIT_DIFFICULTIES],
        });
        habitOptionCount = DEFAULT_HABIT_CATEGORIES.length + DEFAULT_HABIT_PRIORITIES.length + DEFAULT_HABIT_DIFFICULTIES.length;
      }
    } catch (err) {
      console.error('HabitOption seed skipped (table may not exist):', err);
    }

    return NextResponse.json({
      badges: badgeCount === 0 ? DEFAULT_BADGES.length : badgeCount,
      rewards: rewardCount === 0 ? DEFAULT_REWARDS.length : rewardCount,
      transactions: txCount === 0 ? SAMPLE_TRANSACTIONS.length : txCount,
      budgets: budgetCount === 0 ? SAMPLE_BUDGETS.length : budgetCount,
      categories: catCount === 0 ? DEFAULT_EXPENSE_CATEGORIES.length + DEFAULT_INCOME_CATEGORIES.length : catCount,
      habitOptions: habitOptionCount,
      message: 'Seed completed',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}