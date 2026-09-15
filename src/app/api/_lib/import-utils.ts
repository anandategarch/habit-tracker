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
    // Task 60-b (audit 59-b5): goalId (Task 49 habit↔tujuan) HILANG senyap saat
    // restore — /api/data/export mengeksportnya tapi allow-list ini tidak
    // memuatnya. goalId = string id (bukan kolom tanggal).
    // Task 60-c: vacationIntervals (JSON string riwayat liburan) ikut — tanpa
    // ini restore backup memutus janji "streak menyala kembali".
    columns: ['id', 'name', 'emoji', 'category', 'priority', 'difficulty', 'habitType', 'target', 'unit', 'targetType', 'targetDays', 'graduatedAt', 'scheduleJson', 'reminder', 'notes', 'trackTime', 'groupId', 'goalId', 'sortOrder', 'isActive', 'isArchived', 'vacationMode', 'vacationUntil', 'vacationIntervals', 'startDate', 'createdAt', 'updatedAt'],
    dateColumns: ['vacationUntil', 'graduatedAt', 'startDate', 'createdAt', 'updatedAt'],
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
    // Task 60-f: groupId (badge Split) ikut backup-restore.
    columns: ['id', 'type', 'amount', 'category', 'sourceId', 'description', 'notes', 'tags', 'date', 'transferPairId', 'groupId', 'createdAt', 'updatedAt'],
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
  // ── Meja Kerja (Task 60-b / audit 59-b5): 5 tabel ikut backup-restore. ──
  // Kunci mengikuti konvensi payload export (camelCase jamak). dayKey = STRING
  // 'yyyy-MM-dd' Jakarta (konvensi schema Meja Kerja) — sengaja BUKAN
  // dateColumns supaya tetap string saat diimpor; doneAt/dueAt/completedAt
  // adalah DateTime → ISO string dikonversi ke Date seperti kolom lain.
  // Backup LAMA tanpa kunci ini tetap bisa diimpor (route skip senyap).
  {
    key: 'workRoutines',
    columns: ['id', 'title', 'timeOfDay', 'active', 'sortOrder', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
  },
  {
    key: 'workRoutineLogs',
    columns: ['id', 'routineId', 'dayKey', 'done', 'doneAt', 'createdAt'],
    dateColumns: ['doneAt', 'createdAt'],
  },
  {
    key: 'workTasks',
    columns: ['id', 'title', 'notes', 'status', 'dayKey', 'dueAt', 'completedAt', 'createdAt', 'updatedAt'],
    dateColumns: ['dueAt', 'completedAt', 'createdAt', 'updatedAt'],
  },
  {
    key: 'workNotes',
    columns: ['id', 'content', 'tag', 'pinned', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
  },
  {
    key: 'workDayFlags',
    columns: ['id', 'dayKey', 'holiday', 'createdAt', 'updatedAt'],
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
