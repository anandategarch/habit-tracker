// Helper import data: spesifikasi tabel + sanitasi baris (allow-list ketat).
// Konvensi kunci = sama persis dengan payload GET /api/data/export.
import { badRequest } from '@/app/api/_lib/api-utils';

export interface TableSpec {
  /** Kunci pada payload { data }. */
  key: string;
  /** Kolom yang diizinkan masuk (kolom schema Prisma). */
  columns: string[];
  /** Kolom DateTime — nilai ISO string dikonversi ke Date. */
  dateColumns: string[];
}

export const IMPORT_TABLES: TableSpec[] = [
  {
    key: 'habitGroups',
    columns: ['id', 'name', 'color', 'sortOrder'],
    dateColumns: [],
  },
  {
    key: 'habitOptions',
    columns: ['id', 'type', 'label', 'color', 'sortOrder'],
    dateColumns: [],
  },
  {
    key: 'fundSources',
    columns: ['id', 'name', 'emoji', 'type', 'initialBalance', 'isArchived', 'sortOrder', 'createdAt'],
    dateColumns: ['createdAt'],
  },
  {
    key: 'financeCategories',
    columns: ['id', 'name', 'emoji', 'color', 'type'],
    dateColumns: [],
  },
  {
    key: 'habits',
    columns: ['id', 'name', 'emoji', 'category', 'priority', 'difficulty', 'habitType', 'target', 'unit', 'targetType', 'reminder', 'notes', 'trackTime', 'groupId', 'sortOrder', 'isActive', 'isArchived', 'vacationMode', 'vacationUntil', 'startDate', 'createdAt', 'updatedAt'],
    dateColumns: ['vacationUntil', 'startDate', 'createdAt', 'updatedAt'],
  },
  {
    key: 'habitLogs',
    columns: ['id', 'habitId', 'date', 'completed', 'value', 'completedAt', 'notes', 'createdAt', 'updatedAt'],
    dateColumns: ['date', 'completedAt', 'createdAt', 'updatedAt'],
  },
  {
    key: 'dailyLogs',
    columns: ['id', 'date', 'mood', 'energy', 'sleep', 'notes', 'createdAt', 'updatedAt'],
    dateColumns: ['date', 'createdAt', 'updatedAt'],
  },
  {
    key: 'transactions',
    columns: ['id', 'type', 'amount', 'category', 'sourceId', 'description', 'notes', 'tags', 'date', 'transferPairId', 'createdAt', 'updatedAt'],
    dateColumns: ['date', 'createdAt', 'updatedAt'],
  },
  {
    key: 'weeklyBudgets',
    columns: ['id', 'category', 'month', 'amount', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
  },
  {
    key: 'savingsGoals',
    columns: ['id', 'name', 'emoji', 'targetAmount', 'currentAmount', 'deadline', 'completedAt', 'createdAt', 'updatedAt'],
    dateColumns: ['deadline', 'completedAt', 'createdAt', 'updatedAt'],
  },
  {
    key: 'recurringTransactions',
    columns: ['id', 'name', 'amount', 'type', 'category', 'sourceId', 'frequency', 'startDate', 'endDate', 'lastRun', 'isActive', 'createdAt', 'updatedAt'],
    dateColumns: ['startDate', 'endDate', 'lastRun', 'createdAt', 'updatedAt'],
  },
  {
    key: 'transactionRules',
    columns: ['id', 'keyword', 'category', 'sourceId', 'priority', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
  },
  {
    key: 'goals',
    columns: ['id', 'title', 'description', 'priority', 'status', 'deadline', 'milestones', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
  },
];

export const APP_SETTINGS_COLUMNS = ['id', 'userName', 'theme', 'themeColor', 'weekStart', 'language', 'targetCompletion', 'appLockHash', 'updatedAt'];
export const APP_SETTINGS_DATE_COLUMNS = ['updatedAt'];

export const IMPORT_KEYS = new Set<string>([...IMPORT_TABLES.map((t) => t.key), 'appSettings']);

function toDate(value: unknown, label: string): Date {
  const d = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (d === null || Number.isNaN(d.getTime())) {
    throw badRequest(`Kolom tanggal ${label} tidak valid`);
  }
  return d;
}

/**
 * Sanitasi 1 baris: hanya kolom allow-list, tanggal ISO → Date.
 * Baris tanpa id → id dibuang (Prisma membuat id baru; referensi lama hilang).
 */
export function sanitizeRow(
  spec: { columns: string[]; dateColumns: string[] },
  raw: unknown,
  tableLabel: string,
): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw badRequest(`Baris data tabel ${tableLabel} tidak valid`);
  }
  const source = raw as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const col of spec.columns) {
    if (!(col in source)) continue;
    const v = source[col];
    if (spec.dateColumns.includes(col)) {
      row[col] = v === null || v === undefined || v === '' ? null : toDate(v, `${tableLabel}.${col}`);
    } else {
      row[col] = v === undefined ? null : v;
    }
  }
  // Baris tanpa id: biarkan Prisma yang membuat (jangan kirim id null).
  if (row.id === null || row.id === undefined) delete row.id;
  return row;
}
