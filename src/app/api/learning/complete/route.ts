import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { startOfDay, subDays, format } from 'date-fns';

const HABIT_NAME = 'Daily Learning';
const HABIT_ICON = '📚';

// Ensure the Daily Learning habit exists
async function ensureLearningHabit() {
  let habit = await db.habit.findFirst({ where: { name: HABIT_NAME } });
  if (!habit) {
    habit = await db.habit.create({
      data: {
        name: HABIT_NAME,
        icon: HABIT_ICON,
        category: 'Learning',
        priority: 'High',
        difficulty: 'Medium',
        target: 1,
        targetType: 'daily',
        color: '#8b5cf6',
        status: 'active',
      },
    });
  }
  return habit;
}

// POST /api/learning/complete — Mark daily learning as done
export async function POST() {
  try {
    const habit = await ensureLearningHabit();
    const today = startOfDay(new Date());

    const log = await db.habitLog.upsert({
      where: {
        habitId_date: {
          habitId: habit.id,
          date: today,
        },
      },
      create: {
        habitId: habit.id,
        date: today,
        completed: true,
        value: 1,
      },
      update: {
        completed: true,
        value: 1,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('POST /api/learning/complete error:', error);
    return NextResponse.json({ error: 'Failed to mark complete' }, { status: 500 });
  }
}

// GET /api/learning/complete — Get learning status & streak
export async function GET() {
  try {
    const habit = await db.habit.findFirst({ where: { name: HABIT_NAME } });
    if (!habit) {
      return NextResponse.json({ completedToday: false, streak: 0, longestStreak: 0, totalDays: 0 });
    }

    const today = startOfDay(new Date());

    // Check today
    const todayLog = await db.habitLog.findFirst({
      where: { habitId: habit.id, date: today, completed: true },
    });

    // Get all completed logs
    const completedLogs = await db.habitLog.findMany({
      where: { habitId: habit.id, completed: true },
      orderBy: { date: 'asc' },
    });

    const totalDays = completedLogs.length;

    // Calculate current streak
    let currentStreak = 0;
    if (todayLog) {
      currentStreak = 1;
      let checkDate = subDays(today, 1);
      for (let i = 0; i < 365; i++) {
        const key = format(checkDate, 'yyyy-MM-dd');
        const found = completedLogs.find(l => format(l.date, 'yyyy-MM-dd') === key);
        if (found) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
    } else {
      // Check if yesterday was completed (streak might still be alive from yesterday)
      let checkDate = subDays(today, 1);
      for (let i = 0; i < 365; i++) {
        const key = format(checkDate, 'yyyy-MM-dd');
        const found = completedLogs.find(l => format(l.date, 'yyyy-MM-dd') === key);
        if (found) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < completedLogs.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = completedLogs[i - 1].date;
        const currDate = completedLogs[i].date;
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return NextResponse.json({
      completedToday: !!todayLog,
      streak: currentStreak,
      longestStreak,
      totalDays,
    });
  } catch (error) {
    console.error('GET /api/learning/complete error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}