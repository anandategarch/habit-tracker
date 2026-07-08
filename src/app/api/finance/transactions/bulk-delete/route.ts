import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/finance/transactions/bulk-delete
// Body: { ids: string[] }
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    if (ids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per batch' }, { status: 400 });
    }

    const result = await db.transaction.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('POST /api/finance/transactions/bulk-delete error:', error);
    return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 });
  }
}