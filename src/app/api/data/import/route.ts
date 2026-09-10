// POST /api/data/import — restore penuh dari payload GET /api/data/export.
// deleteMany semua tabel lalu insert dalam satu transaction; validasi
// allow-list ketat (JSON invalid / struktur asing → 400).
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import {
  APP_SETTINGS_COLUMNS,
  APP_SETTINGS_DATE_COLUMNS,
  IMPORT_KEYS,
  IMPORT_TABLES,
  sanitizeRow,
} from '@/app/api/_lib/import-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const data = body.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw badRequest('Field data tidak valid (harus objek berisi data backup)');
    }
    const payload = data as Record<string, unknown>;

    // Allow-list keys — kunci asing ditolak.
    for (const key of Object.keys(payload)) {
      if (!IMPORT_KEYS.has(key)) {
        throw badRequest(`Struktur data tidak dikenal: ${key}`);
      }
    }

    // Validasi + sanitasi awal per tabel (array of object).
    const tables = new Map<string, Array<Record<string, unknown>>>();
    for (const spec of IMPORT_TABLES) {
      if (!(spec.key in payload)) continue;
      const value = payload[spec.key];
      if (!Array.isArray(value)) {
        throw badRequest(`Data tabel ${spec.key} tidak valid (harus array)`);
      }
      tables.set(spec.key, value.map((row) => sanitizeRow(spec, row, spec.key)));
    }

    // appSettings: objek tunggal (atau array 1 elemen — toleransi).
    let settingsRow: Record<string, unknown> | null = null;
    if ('appSettings' in payload && payload.appSettings !== null) {
      const raw = payload.appSettings;
      const single = Array.isArray(raw) ? raw[0] : raw;
      if (single === null || typeof single !== 'object' || Array.isArray(single)) {
        throw badRequest('Data appSettings tidak valid');
      }
      settingsRow = sanitizeRow(
        { columns: APP_SETTINGS_COLUMNS, dateColumns: APP_SETTINGS_DATE_COLUMNS },
        single,
        'appSettings',
      );
      settingsRow.id = 'singleton';
    }

    // Urutan hapus (aman FK) — semua tabel, appSettings di-upsert ulang.
    const counts: Record<string, number> = {};
    try {
      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.habitLog.deleteMany();
        await tx.transaction.deleteMany();
        await tx.fundSource.deleteMany();
        await tx.habit.deleteMany();
        await tx.habitGroup.deleteMany();
        await tx.habitOption.deleteMany();
        await tx.dailyLog.deleteMany();
        await tx.financeCategory.deleteMany();
        await tx.weeklyBudget.deleteMany();
        await tx.budgetSnapshot.deleteMany();
        await tx.savingsGoal.deleteMany();
        await tx.recurringTransaction.deleteMany();
        await tx.transactionRule.deleteMany();
        await tx.goal.deleteMany();
        await tx.appSettings.deleteMany();

        // Insert urut dependensi.
        if (settingsRow) {
          await tx.appSettings.create({ data: settingsRow as Parameters<typeof tx.appSettings.create>[0]['data'] });
        } else {
          await tx.appSettings.create({ data: { id: 'singleton' } });
        }

        for (const group of tables.get('habitGroups') ?? [])
          await tx.habitGroup.create({ data: group as Parameters<typeof tx.habitGroup.create>[0]['data'] });
        for (const option of tables.get('habitOptions') ?? [])
          await tx.habitOption.create({ data: option as Parameters<typeof tx.habitOption.create>[0]['data'] });
        for (const source of tables.get('fundSources') ?? [])
          await tx.fundSource.create({ data: source as Parameters<typeof tx.fundSource.create>[0]['data'] });
        for (const cat of tables.get('financeCategories') ?? [])
          await tx.financeCategory.create({ data: cat as Parameters<typeof tx.financeCategory.create>[0]['data'] });
        for (const budget of tables.get('weeklyBudgets') ?? [])
          await tx.weeklyBudget.create({ data: budget as Parameters<typeof tx.weeklyBudget.create>[0]['data'] });
        for (const goal of tables.get('savingsGoals') ?? [])
          await tx.savingsGoal.create({ data: goal as Parameters<typeof tx.savingsGoal.create>[0]['data'] });
        for (const recurring of tables.get('recurringTransactions') ?? [])
          await tx.recurringTransaction.create({ data: recurring as Parameters<typeof tx.recurringTransaction.create>[0]['data'] });
        for (const rule of tables.get('transactionRules') ?? [])
          await tx.transactionRule.create({ data: rule as Parameters<typeof tx.transactionRule.create>[0]['data'] });
        for (const goal of tables.get('goals') ?? [])
          await tx.goal.create({ data: goal as Parameters<typeof tx.goal.create>[0]['data'] });
        for (const habit of tables.get('habits') ?? [])
          await tx.habit.create({ data: habit as Parameters<typeof tx.habit.create>[0]['data'] });
        for (const log of tables.get('dailyLogs') ?? [])
          await tx.dailyLog.create({ data: log as Parameters<typeof tx.dailyLog.create>[0]['data'] });
        for (const log of tables.get('habitLogs') ?? [])
          await tx.habitLog.create({ data: log as Parameters<typeof tx.habitLog.create>[0]['data'] });

        // Transaksi: 2 fase karena relasi diri transferPairId.
        const txRows = tables.get('transactions') ?? [];
        const pairLinks: Array<{ id: string; transferPairId: string }> = [];
        const newIds = new Set<string>();
        for (const row of txRows) {
          const { transferPairId, ...rest } = row;
          if (typeof row.id === 'string') newIds.add(row.id);
          await tx.transaction.create({ data: rest as Parameters<typeof tx.transaction.create>[0]['data'] });
          if (typeof transferPairId === 'string' && transferPairId) {
            pairLinks.push({ id: row.id as string, transferPairId });
          }
        }
        for (const link of pairLinks) {
          // Hubungkan hanya bila pasangannya ikut diimpor (hindari FK dangling).
          if (newIds.has(link.transferPairId)) {
            await tx.transaction.update({ where: { id: link.id }, data: { transferPairId: link.transferPairId } });
          }
        }
      });
    } catch (txError) {
      if (txError instanceof Error && 'status' in txError) throw txError;
      console.error('[api:data/import:POST] prisma', txError);
      throw badRequest('Data impor tidak valid — periksa kembali struktur backup');
    }

    for (const [key, rows] of tables.entries()) counts[key] = rows.length;

    return NextResponse.json({ ok: true, restored: counts });
  } catch (error) {
    return handleApiError(error, 'data/import:POST');
  }
}
