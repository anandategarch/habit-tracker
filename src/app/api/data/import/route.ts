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
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Task 36: INSERT habit bisa memuat kolom targetDays/graduatedAt dari
    // backup baru — pastikan kolom ada sebelum transaksi.
    await ensureHabitGraduation();
    // Task 60-b (audit 59-b5): backup baru memuat 5 tabel Meja Kerja —
    // pastikan tabelnya ada dulu (ensure-DDL runtime, no-op lokal) supaya
    // deleteMany/create di transaksi bawah tidak 500 di DB produksi segar.
    await ensureWorkTables();
    // Task 60-f: INSERT Transaction bisa memuat groupId dari backup baru.
    await ensureTransactionGroupId();
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
        // Meja Kerja (Task 60-b): log dulu baru rutinitas (FK routineId).
        // Backup LAMA tanpa kunci work* tetap bisa diimpor — deleteMany di
        // tabel kosong = no-op (skip senyap, backward-compatible).
        await tx.workRoutineLog.deleteMany();
        await tx.workRoutine.deleteMany();
        await tx.workTask.deleteMany();
        await tx.workNote.deleteMany();
        await tx.workDayFlag.deleteMany();
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
        // Meja Kerja (Task 60-b): urut dependensi — rutinitas dulu baru log-nya
        // (FK routineId); tugas/catatan/penanda hari bebas urutan.
        for (const routine of tables.get('workRoutines') ?? [])
          await tx.workRoutine.create({ data: routine as Parameters<typeof tx.workRoutine.create>[0]['data'] });
        for (const log of tables.get('workRoutineLogs') ?? [])
          await tx.workRoutineLog.create({ data: log as Parameters<typeof tx.workRoutineLog.create>[0]['data'] });
        for (const task of tables.get('workTasks') ?? [])
          await tx.workTask.create({ data: task as Parameters<typeof tx.workTask.create>[0]['data'] });
        for (const note of tables.get('workNotes') ?? [])
          await tx.workNote.create({ data: note as Parameters<typeof tx.workNote.create>[0]['data'] });
        for (const flag of tables.get('workDayFlags') ?? [])
          await tx.workDayFlag.create({ data: flag as Parameters<typeof tx.workDayFlag.create>[0]['data'] });
        // Task 61-h: id Goal/HabitGroup yang benar-benar diimpor — dipakai
        // untuk menolkan referensi habit yang menggantung (mirror pairLinks).
        const goalIds = new Set<string>();
        for (const goal of tables.get('goals') ?? []) {
          if (typeof goal.id === 'string' && goal.id) goalIds.add(goal.id);
        }
        const habitGroupIds = new Set<string>();
        for (const group of tables.get('habitGroups') ?? []) {
          if (typeof group.id === 'string' && group.id) habitGroupIds.add(group.id);
        }
        for (const habit of tables.get('habits') ?? []) {
          // Task 61-h (audit 61-c P3-13): mirror pola pairLinks — referensi
          // goalId/groupId yang tujuannya TIDAK ikut diimpor dinolkan (bukan
          // disimpan menggantung) supaya chip tujuan/grup di UI tidak yatim.
          if (typeof habit.goalId === 'string' && habit.goalId && !goalIds.has(habit.goalId)) {
            habit.goalId = null;
          }
          if (typeof habit.groupId === 'string' && habit.groupId && !habitGroupIds.has(habit.groupId)) {
            habit.groupId = null;
          }
          await tx.habit.create({ data: habit as Parameters<typeof tx.habit.create>[0]['data'] });
        }
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
      // Task 61-h (audit 61-c P3-12): HANYA error Prisma known-request
      // (mis. P2002 unik / P2003 FK / P2025) yang berarti data impor memang
      // tidak valid → 400. Kegagalan lain (DB down, koneksi, infra) diteruskan
      // supaya handleApiError mengembalikan 500 generik yang jujur — dulunya
      // SEMUA error dipetakan 400 sehingga diagnosis infra tertutup.
      if (txError instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('[api:data/import:POST] prisma', txError);
        throw badRequest('Data impor tidak valid — periksa kembali struktur backup');
      }
      throw txError;
    }

    for (const [key, rows] of tables.entries()) counts[key] = rows.length;

    return NextResponse.json({ ok: true, restored: counts });
  } catch (error) {
    return handleApiError(error, 'data/import:POST');
  }
}
