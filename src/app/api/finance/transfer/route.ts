import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// BUG-10 fix: removed unused jakartaNowIso import (was assigned but never used).

// POST /api/finance/transfer
// Transfer money between fund sources. Creates 2 linked transactions
// (expense from source, income to destination) + atomically updates
// both balances in a single db.$transaction.
//
// Transfer transactions use category "Transfer Antar Sumber" and are
// excluded from Daily Recap income/expense stats (they're internal
// movements, not real income/expense).
//
// Request body:
//   fromSourceId: string (cuid)
//   toSourceId: string (cuid, must differ from fromSourceId)
//   amount: number (positive, whole rupiah)
//   description?: string (optional note)
//
// Response: { fromTransaction, toTransaction, fromSource, toSource }

const transferSchema = z.object({
  fromSourceId: z.string().min(1, 'Sumber asal wajib diisi'),
  toSourceId: z.string().min(1, 'Sumber tujuan wajib diisi'),
  amount: z
    .union([z.string(), z.number()])
    .refine((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) && n > 0 && Number.isInteger(n);
    }, 'Jumlah harus bilangan bulat positif')
    .transform((v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10))),
  description: z.string().max(500).nullish().transform((v) => v ?? null),
}).refine((d) => d.fromSourceId !== d.toSourceId, {
  message: 'Sumber asal dan tujuan tidak boleh sama',
  path: ['toSourceId'],
});

const TRANSFER_CATEGORY = 'Transfer Antar Sumber';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const message = firstError
        ? `${firstError.path.join('.') || 'input'}: ${firstError.message}`
        : 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { fromSourceId, toSourceId, amount, description } = parsed.data;

    // Execute both transactions + balance updates atomically.
    // If any step fails, the entire operation rolls back — no partial
    // transfers (which would corrupt balances).
    const result = await db.$transaction(async (tx) => {
      // Fetch both sources (lock via findUnique inside transaction)
      const fromSource = await tx.fundSource.findUnique({ where: { id: fromSourceId } });
      const toSource = await tx.fundSource.findUnique({ where: { id: toSourceId } });

      if (!fromSource) {
        throw new Error('FROM_NOT_FOUND');
      }
      if (!toSource) {
        throw new Error('TO_NOT_FOUND');
      }

      // Check sufficient balance (allow negative? No — reject if insufficient)
      if (fromSource.balance < amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const now = new Date();
      const transferNote = description || `Transfer ${fromSource.name} → ${toSource.name}`;

      // Create expense transaction (from source)
      const fromTx = await tx.transaction.create({
        data: {
          type: 'expense',
          amount,
          category: TRANSFER_CATEGORY,
          description: transferNote,
          date: now,
          source: fromSource.name,
          notes: `Transfer ke ${toSource.name}`,
        },
      });

      // Create income transaction (to source)
      const toTx = await tx.transaction.create({
        data: {
          type: 'income',
          amount,
          category: TRANSFER_CATEGORY,
          description: transferNote,
          date: now,
          source: toSource.name,
          notes: `Transfer dari ${fromSource.name}`,
        },
      });

      // Atomically update both balances
      const updatedFrom = await tx.fundSource.update({
        where: { id: fromSourceId },
        data: { balance: { increment: -amount } },
      });
      // BUG-5 fix: verify balance didn't go negative after decrement.
      // The pre-check (line 70) uses a stale read — under concurrent
      // transfers, two requests can both pass the check and both decrement.
      // This post-increment check catches the race: if the result is
      // negative, throw to roll back the entire transaction (both tx
      // creates + both balance updates are undone atomically).
      if (updatedFrom.balance < 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const updatedTo = await tx.fundSource.update({
        where: { id: toSourceId },
        data: { balance: { increment: amount } },
      });

      return { fromTx, toTx, fromSource: updatedFrom, toSource: updatedTo };
    });

    return NextResponse.json({
      message: 'Transfer berhasil',
      fromTransaction: result.fromTx,
      toTransaction: result.toTx,
      fromSource: { name: result.fromSource.name, balance: result.fromSource.balance },
      toSource: { name: result.toSource.name, balance: result.toSource.balance },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FROM_NOT_FOUND') {
        return NextResponse.json({ error: 'Sumber asal tidak ditemukan' }, { status: 404 });
      }
      if (error.message === 'TO_NOT_FOUND') {
        return NextResponse.json({ error: 'Sumber tujuan tidak ditemukan' }, { status: 404 });
      }
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json({ error: 'Saldo tidak mencukupi' }, { status: 400 });
      }
    }
    console.error('POST /api/finance/transfer error:', error);
    return NextResponse.json({ error: 'Transfer gagal' }, { status: 500 });
  }
}
