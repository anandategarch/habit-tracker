import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Known category emojis by name
const KNOWN_EMOJIS: Record<string, { emoji: string; color: string }> = {
  'Makanan & Minuman': { emoji: '🍽️', color: '#ef4444' },
  'Transportasi': { emoji: '🚗', color: '#f97316' },
  'Belanja': { emoji: '🛍️', color: '#eab308' },
  'Hiburan': { emoji: '🎮', color: '#a855f7' },
  'Kesehatan': { emoji: '🏥', color: '#ec4899' },
  'Pendidikan': { emoji: '📚', color: '#3b82f6' },
  'Tagihan & Utilitas': { emoji: '📋', color: '#6366f1' },
  'Tabungan & Investasi': { emoji: '🏦', color: '#14b8a6' },
  'Gaji': { emoji: '💰', color: '#22c55e' },
  'Freelance': { emoji: '💻', color: '#06b6d4' },
  'Investasi': { emoji: '📈', color: '#f59e0b' },
  'Bisnis': { emoji: '🏢', color: '#8b5cf6' },
};

// POST /api/finance/categories/migrate-emojis
// One-time migration: update categories that still have default 📦 emoji
export async function POST() {
  try {
    const categories = await db.financeCategory.findMany();
    let updated = 0;

    for (const cat of categories) {
      const known = KNOWN_EMOJIS[cat.name];
      if (known && cat.emoji === '📦') {
        await db.financeCategory.update({
          where: { id: cat.id },
          data: { emoji: known.emoji, color: known.color },
        });
        updated++;
      }
    }

    return NextResponse.json({ success: true, updated, total: categories.length });
  } catch (error) {
    console.error('Migrate emojis error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}