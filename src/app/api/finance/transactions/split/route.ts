import { db } from '@/lib/db';
import { toMoneyInt, signedDelta } from '@/lib/money';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Schema ───────────────────────────────────────────────────────────────
//
// Split Transaction:
//   A single real-world payment split across multiple expense categories.
//   e.g. "Belanja di Indomaret Rp 150.000" → Makanan 100k + Kebersihan 50k.
//
//   All child transactions share the SAME date, source, description, type='expense',
//   and groupId. Each child has a different category + amount.
//
//   The FundSource balance is decremented ONCE by the TOTAL amount (not N times
//   by each child amount — that would be functionally identical but this way
//   the balance update is a single atomic increment matching the logical
//   "one payment" semantics, and is easier to audit).

const splitItemSchema = z.object({
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(100),
  // Accept string ("1.500.000") or number — normalise via toMoneyInt.
  amount: z
    .union([z.string(), z.number()])
    .refine((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) && n > 0 && Number.isInteger(n);
    }, 'Jumlah harus bilangan bulat positif')
    .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10))),
});

const splitTransactionSchema = z.object({
  date: z.coerce.date(),
  source: z.string().trim().min(1, 'Sumber dana wajib diisi').max(100),
  description: z.string().trim().max(500).nullish().transform((v) => v ?? null),
  splits: z
    .array(splitItemSchema)
    .min(2, 'Minimal 2 kategori untuk split')
    .max(10, 'Maksimal 10 kategori untuk split'),
});

// ── Route ────────────────────────────────────────────────────────────────

// POST /api/finance/transactions/split
// Body: { date, source, description?, splits: [{category, amount}, ...] }
//
// Creates N expense transactions sharing a groupId, and decrements the
// FundSource balance by the total amount. Atomic via db.$transaction.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = splitTransactionSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const message = firstError
        ? `${firstError.path.join('.') || 'input'}: ${firstError.message}`
        : 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { date, source, description, splits } = parsed.data;

    // Defensive normalisation — zod transform already guarantees positive
    // integers, but toMoneyInt is a no-op here and keeps the type narrowing
    // explicit for downstream Prisma writes.
    const normalizedSplits = splits.map((s) => ({
      category: s.category,
      amount: toMoneyInt(s.amount),
    }));

    const totalAmount = normalizedSplits.reduce((sum, s) => sum + s.amount, 0);
    const n = normalizedSplits.length;

    // Generate groupId for the split group.
    // crypto.randomUUID() is built-in (Node 19+, all modern browsers, Vercel
    // serverless). No external dep needed.
    const groupId = crypto.randomUUID();

    const created = await db.$transaction(async (tx) => {
      // Verify the FundSource exists. Unlike the regular transactions POST
      // (which silently skips the balance update if the source is missing),
      // for split we treat a missing source as a hard error — the user
      // explicitly chose this source via the dropdown, so a missing row
      // indicates either a stale client cache or a race with source deletion.
      const fundSource = await tx.fundSource.findUnique({ where: { name: source } });
      if (!fundSource) {
        throw new Error('SOURCE_NOT_FOUND');
      }

      // Insufficient balance check — split transactions are real expenses,
      // so a split that would drive the source negative is rejected.
      // (FundSource.balance is in whole rupiah, never float.)
      if (fundSource.balance < totalAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Decrement the source balance ONCE by the total amount.
      // Using Prisma's atomic `increment` with a negative value avoids the
      // lost-update race of read-modify-write. Same pattern as the regular
      // transactions POST route, just with the total instead of per-row.
      const updatedSource = await tx.fundSource.update({
        where: { id: fundSource.id },
        data: { balance: { increment: signedDelta(totalAmount, 'expense') } },
      });

      // BUG-1 fix: post-increment balance check. The pre-check (line 93)
      // uses a stale read — under concurrent submissions, two requests can
      // both pass the check and both decrement. This post-check catches the
      // race: if the result is negative, throw to roll back the entire
      // transaction (balance update + all created rows are undone).
      if (updatedSource.balance < 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Create all split transactions in a single query (createMany) instead
      // of a sequential for-loop of N `create` calls. This reduces N DB
      // round-trips down to 1, which is faster and avoids partial-write
      // windows between iterations (though the outer db.$transaction already
      // guarantees atomicity, fewer round-trips still mean less time holding
      // the transaction).
      //
      // All children share groupId/date/source/description/type='expense'.
      // notes is per-child: "Split 1/3", "Split 2/3", ... so users can see
      // the split relationship when editing individual transactions.
      //
      // BUG-9 note: the "n" in "Split i/n" reflects the ORIGINAL split size at
      // creation time. If a child is later deleted, "n" is NOT updated — the
      // remaining children keep their original "Split i/3" notes even after
      // one is removed. This is acceptable: the note is a creation-time
      // annotation indicating "this row was child #i of an originally-3-way
      // split", not a live count of current group size.
      await tx.transaction.createMany({
        data: normalizedSplits.map((s, i) => ({
          type: 'expense',
          amount: s.amount,
          category: s.category,
          description,
          date,
          notes: `Split ${i + 1}/${n}`,
          source,
          groupId,
        })),
      });

      // createMany returns only a count, not the created records. Re-fetch
      // them by groupId so the response includes the full transaction objects
      // (matching the previous shape returned to the client).
      const records = await tx.transaction.findMany({
        where: { groupId },
        orderBy: { createdAt: 'asc' },
      });

      return records;
    });

    return NextResponse.json({ groupId, transactions: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'SOURCE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Sumber dana tidak ditemukan. Muat ulang halaman dan coba lagi.' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { error: 'Saldo sumber dana tidak mencukupi untuk split ini.' },
        { status: 400 }
      );
    }
    console.error('POST /api/finance/transactions/split error:', error);
    return NextResponse.json({ error: 'Failed to create split transaction' }, { status: 500 });
  }
}
