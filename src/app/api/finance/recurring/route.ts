// GET/POST /api/finance/recurring — transaksi berulang.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { parseRecurringFields } from '@/app/api/_lib/recurring-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const recurring = await db.recurringTransaction.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ recurring });
  } catch (error) {
    return handleApiError(error, 'finance/recurring:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const data = await parseRecurringFields(body, 'create');
    const recurring = await db.recurringTransaction.create({
      data: data as Parameters<typeof db.recurringTransaction.create>[0]['data'],
    });
    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/recurring:POST');
  }
}
