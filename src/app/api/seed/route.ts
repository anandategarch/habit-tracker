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

export async function GET() {
  try {
    const badgeCount = await db.badge.count();
    const rewardCount = await db.reward.count();

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

    return NextResponse.json({
      badges: badgeCount === 0 ? DEFAULT_BADGES.length : badgeCount,
      rewards: rewardCount === 0 ? DEFAULT_REWARDS.length : rewardCount,
      message: 'Seed completed',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}