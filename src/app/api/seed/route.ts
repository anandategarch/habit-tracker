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

export async function GET() {
  try {
    const badgeCount = await db.badge.count();
    const rewardCount = await db.reward.count();
    const txCount = await db.transaction.count();
    const budgetCount = await db.budget.count();

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

    return NextResponse.json({
      badges: badgeCount === 0 ? DEFAULT_BADGES.length : badgeCount,
      rewards: rewardCount === 0 ? DEFAULT_REWARDS.length : rewardCount,
      transactions: txCount === 0 ? SAMPLE_TRANSACTIONS.length : txCount,
      budgets: budgetCount === 0 ? SAMPLE_BUDGETS.length : budgetCount,
      message: 'Seed completed',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}