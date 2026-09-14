// Validasi field Habit (dipakai POST /api/habits dan PUT /api/habits/[id]).
import { db } from '@/lib/db';
import {
  asBool,
  asNumber,
  asString,
  badRequest,
  clamp,
} from '@/app/api/_lib/api-utils';
import { dateFromYMD, isValidYMD } from '@/lib/timezone';
import { normalizeSchedule, serializeSchedule } from '@/lib/habit-schedule';

const HABIT_TYPES = new Set(['normal', 'amount', 'avoid']);
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard', 'Mudah', 'Sedang', 'Sulit']);

export interface HabitFieldResult {
  data: Record<string, unknown>;
  /** groupId baru yang harus divalidasi ke tabel HabitGroup (null = tidak dikirim). */
  pendingGroupId: string | null | undefined;
  /** CONNECTED-APP — true bila body mengirim goalId (untuk invalidasi ['goals']). */
  hasGoalId: boolean;
}

/**
 * Parse partial field habit. Hanya field yang ada di body yang masuk `data`.
 * Semua invalid → 400 (pesan Indonesia). Konvensi default:
 * difficulty 'Medium', priority 'Sedang', target clamp 1..1000 (amount) / 1.
 */
export async function parseHabitFields(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): Promise<HabitFieldResult> {
  const data: Record<string, unknown> = {};
  let pendingGroupId: string | null | undefined = undefined;

  if (mode === 'create' || 'name' in body) {
    const name = asString(body.name);
    if (name === null || !name.trim() || name.trim().length > 120) {
      throw badRequest('Nama habit wajib diisi (maks. 120 karakter)');
    }
    data.name = name.trim();
  }
  if ('emoji' in body) {
    const emoji = asString(body.emoji);
    if (emoji === null || emoji.length > 16) throw badRequest('Emoji tidak valid');
    data.emoji = emoji || '✅';
  }
  if ('category' in body) {
    const category = asString(body.category);
    if (category === null || !category.trim() || category.trim().length > 60) {
      throw badRequest('Kategori tidak valid');
    }
    data.category = category.trim();
  }
  if ('priority' in body) {
    const priority = asString(body.priority);
    if (priority === null || !priority.trim() || priority.trim().length > 40) {
      throw badRequest('Prioritas tidak valid');
    }
    data.priority = priority.trim();
  }
  if ('difficulty' in body) {
    const difficulty = asString(body.difficulty);
    if (difficulty === null || !difficulty.trim() || difficulty.trim().length > 40) {
      throw badRequest('Kesulitan tidak valid');
    }
    data.difficulty = difficulty.trim();
  }
  if ('habitType' in body) {
    const habitType = asString(body.habitType);
    if (habitType === null || !HABIT_TYPES.has(habitType)) {
      throw badRequest('Tipe habit tidak valid (normal, amount, atau avoid)');
    }
    data.habitType = habitType;
  }
  if ('target' in body) {
    const target = asNumber(body.target);
    if (target === null || !Number.isFinite(target)) throw badRequest('Target tidak valid');
    data.target = Math.round(clamp(target, 1, 1000));
  }
  if ('unit' in body) {
    const unit = asString(body.unit);
    if (unit !== null && unit.length > 40) throw badRequest('Satuan tidak valid');
    data.unit = unit && unit.trim() ? unit.trim() : null;
  }
  if ('targetType' in body) {
    const targetType = asString(body.targetType);
    if (targetType !== null && targetType.length > 20) throw badRequest('Jenis target tidak valid');
    data.targetType = targetType && targetType.trim() ? targetType.trim() : null;
  }
  // Task 36 — Target Lulus: jumlah hari selesai yang dituju sebelum habit
  // lulus. null/kosong = tanpa target. Habit 'avoid' tidak punya garis
  // finis (hari tanpa log = bersih) → dipaksa null.
  if ('targetDays' in body) {
    const raw = body.targetDays;
    if (raw === null || raw === '' || raw === 0) {
      data.targetDays = null;
    } else {
      const targetDays = asNumber(raw);
      if (targetDays === null || !Number.isFinite(targetDays)) {
        throw badRequest('Target lulus tidak valid');
      }
      data.targetDays = Math.round(clamp(targetDays, 1, 1000));
    }
    if (data.habitType === 'avoid' || body.habitType === 'avoid') {
      data.targetDays = null;
    }
  }
  // Task 36 — kelulusan: kirim ISO/YMD untuk luluskan, null untuk batalkan.
  // Dikirim eksplisit (bukan dari form biasa) supaya edit habit tidak
  // kebetulan menghapus status lulus.
  if ('graduatedAt' in body) {
    const raw = body.graduatedAt;
    if (raw === null || raw === '' || raw === false) {
      data.graduatedAt = null;
    } else if (raw === true) {
      data.graduatedAt = new Date();
    } else {
      const str = asString(raw);
      if (str !== null && isValidYMD(str)) {
        data.graduatedAt = dateFromYMD(str);
      } else if (str !== null && !Number.isNaN(new Date(str).getTime())) {
        data.graduatedAt = new Date(str);
      } else {
        throw badRequest('Tanggal lulus tidak valid');
      }
    }
  }
  // Task 37 — Jadwal Tampil: habit mingguan/bulanan hanya muncul di hari
  // terjadwalnya. Menerima objek {kind,days|dates}, string JSON, atau
  // null/'' (→ setiap hari). Weekly butuh ≥1 hari (0-6, 0=Minggu), monthly
  // butuh ≥1 tanggal (1-31); duplikat dinormalisasi & diurutkan.
  if ('scheduleJson' in body || 'schedule' in body) {
    const raw = 'schedule' in body ? body.schedule : body.scheduleJson;
    if (raw === null || raw === undefined || raw === '') {
      data.scheduleJson = null;
    } else {
      let parsed: unknown = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw badRequest('Jadwal habit tidak valid');
        }
      }
      const sched = normalizeSchedule(parsed);
      if (!sched) {
        throw badRequest('Jadwal tidak valid — pilih minimal satu hari/tanggal');
      }
      data.scheduleJson = serializeSchedule(sched);
    }
  }
  if ('reminder' in body) {
    const reminder = asString(body.reminder);
    if (reminder !== null && reminder.length > 60) throw badRequest('Pengingat tidak valid');
    data.reminder = reminder && reminder.trim() ? reminder.trim() : null;
  }
  if ('notes' in body) {
    const notes = asString(body.notes);
    if (notes !== null && notes.length > 2000) throw badRequest('Catatan terlalu panjang');
    data.notes = notes ?? null;
  }
  if ('trackTime' in body) {
    const trackTime = asBool(body.trackTime);
    if (trackTime === null) throw badRequest('Nilai trackTime tidak valid');
    data.trackTime = trackTime;
  }
  if ('groupId' in body) {
    if (body.groupId === null || body.groupId === '') {
      data.groupId = null;
      pendingGroupId = null;
    } else {
      const groupId = asString(body.groupId);
      if (groupId === null || !groupId.trim()) throw badRequest('Grup tidak valid');
      pendingGroupId = groupId.trim();
      data.groupId = pendingGroupId;
    }
  }
  if ('sortOrder' in body) {
    const sortOrder = asNumber(body.sortOrder);
    if (sortOrder === null || !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');
    data.sortOrder = clamp(sortOrder, -100_000, 100_000);
  }
  if ('isActive' in body) {
    const isActive = asBool(body.isActive);
    if (isActive === null) throw badRequest('Nilai isActive tidak valid');
    data.isActive = isActive;
  }
  if ('isArchived' in body) {
    const isArchived = asBool(body.isArchived);
    if (isArchived === null) throw badRequest('Nilai isArchived tidak valid');
    data.isArchived = isArchived;
  }
  if ('vacationMode' in body) {
    const vacationMode = asBool(body.vacationMode);
    if (vacationMode === null) throw badRequest('Nilai vacationMode tidak valid');
    data.vacationMode = vacationMode;
  }
  if ('vacationUntil' in body) {
    if (body.vacationUntil === null || body.vacationUntil === '') {
      data.vacationUntil = null;
    } else {
      const raw = asString(body.vacationUntil);
      if (raw !== null && isValidYMD(raw)) {
        data.vacationUntil = dateFromYMD(raw);
      } else if (raw !== null && !Number.isNaN(new Date(raw).getTime())) {
        data.vacationUntil = new Date(raw);
      } else {
        throw badRequest('Tanggal akhir liburan tidak valid');
      }
    }
  }
  if ('startDate' in body) {
    if (body.startDate === null || body.startDate === '') {
      data.startDate = new Date();
    } else {
      const raw = asString(body.startDate);
      if (raw !== null && isValidYMD(raw)) {
        data.startDate = dateFromYMD(raw);
      } else if (raw !== null && !Number.isNaN(new Date(raw).getTime())) {
        data.startDate = new Date(raw);
      } else {
        throw badRequest('Tanggal mulai tidak valid');
      }
    }
  }

  // Validasi FK groupId (hindari error Prisma yang tidak informatif).
  if (pendingGroupId) {
    const group = await db.habitGroup.findUnique({ where: { id: pendingGroupId }, select: { id: true } });
    if (!group) throw badRequest('Grup habit tidak ditemukan');
  }

  if (mode === 'create') {
    if (data.habitType === undefined) data.habitType = 'normal';
    if (data.difficulty === undefined) data.difficulty = 'Medium';
    if (data.priority === undefined) data.priority = 'Sedang';
    if (data.category === undefined) data.category = 'General';
    if (data.target === undefined) data.target = data.habitType === 'amount' ? 8 : 1;
    if (data.habitType !== 'amount' && data.target !== 1) {
      // non-amount: target selalu 1 (clamp ulang)
      data.target = 1;
    }
  }

  // CONNECTED-APP (Task 49): goalId — link habit → tujuan. String kosong /
  // null melepas link. Nilai divalidasi ke tabel Goal (404-style 400 bila
  // tujuan tidak ada) supaya link menggantung tidak pernah tersimpan.
  let hasGoalId = false;
  if ('goalId' in body) {
    hasGoalId = true;
    const raw = body.goalId;
    if (raw === null || raw === '' || raw === 'null') {
      data.goalId = null;
    } else {
      const goalId = asString(raw);
      if (goalId === null || !goalId.trim() || goalId.trim().length > 64) {
        throw badRequest('Tujuan tidak valid');
      }
      const goalIdTrimmed = goalId.trim();
      const goal = await db.goal.findUnique({ where: { id: goalIdTrimmed }, select: { id: true } });
      if (!goal) throw badRequest('Tujuan tidak ditemukan');
      data.goalId = goalIdTrimmed;
    }
  }

  return { data, pendingGroupId, hasGoalId };
}

export { DIFFICULTIES };
