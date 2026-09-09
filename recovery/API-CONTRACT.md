# API Contract — Rutina Rebuild

Semua agent WAJIB mengikuti kontrak ini. Bentuk response error konsisten:
`{ "error": "pesan Indonesia" }` + status HTTP sesuai (400/404/500).

## Konvensi umum
- Semua tanggal logis = hari Jakarta. Storage: HabitLog/DailyLog.date = UTC-midnight; Transaction.date = 12:00Z; completedAt = ISO +07:00.
- Kunci hari di client = `date.toISOString().slice(0,10)` (atau string date dari API langsung dislice).
- Lib yang SUDAH ADA (jangan tulis ulang): `@/lib/timezone` (jakartaDateString, jakartaDateKey, jakartaMonthString, jakartaNowIso, jakartaNowParts, dateFromYMD, dateFromYMDNoon, isValidYMD, isValidMonth, monthRangeYMD), `@/lib/date-utils` (format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isBefore, startOfDay, getDaysInMonth, getDate, id), `@/lib/money`, `@/lib/finance-helpers`, `@/lib/mood` (MOOD_EMOJIS, ENERGY_EMOJIS), `@/lib/dashboard-helpers` (XP_MAP, calcLevel, levelProgress, computeStreakFromSet, shiftYmd, buildLogMap), `@/lib/emoji-color`, `@/lib/theme-utils`, `@/lib/confetti`, `@/lib/settings-types` (AppSettings), `@/store/app-store`, `@/hooks/use-finance-mutations` (sudah ada — recovery), `@/hooks/use-habit-options`, `@/hooks/use-theme-color`.
- Tipe yang SUDAH ADA: `@/components/habit-tracker/daily-tracker-types` (Habit, HabitLog, DailyLog, HabitOption, HabitGroup), `@/components/habit-tracker/finance-types` (Transaction, FundSource, FinanceCategory, BudgetItem, SavingsGoal, RecurringTransaction, TransactionRule, TxFormState, dst).
- Komponen UI yang sudah ada: shadcn lengkap di `@/components/ui/*` + `page-header` + `loaders` (SproutGrow {size}).

## Endpoints

### GET /api/settings → AppSettings
PUT /api/settings {userName?, theme?, themeColor?, weekStart?, language?, targetCompletion?} → AppSettings (partial-safe, singleton).

### GET /api/habits → { habits: Habit[] } (habit aktif non-archived, urut sortOrder; tiap habit + `completedLogCount` = jumlah log completed all-time) 
POST /api/habits (buat habit; field schema Prisma) → Habit
PUT /api/habits/[id] → Habit ; DELETE /api/habits/[id] (cascade log) → {ok:true}

### GET /api/habits/[id]/logs?month=yyyy-MM → { logs: HabitLog[] } (bulan Jakarta, validasi month ketat 400)
POST /api/habits/[id]/logs { date: 'yyyy-MM-dd', completed: boolean, value?: number, completedAt?: ISO, notes? } → HabitLog
  * UPSERT by (habitId, date). Partial update: field yang dikirim saja yang diubah (`...(value !== undefined && { value })`) — binary toggle tidak menghancurkan progress amount.
  * Guard tanggal future → 400 "Tidak bisa mencatat habit untuk tanggal yang akan datang".
  * Normalisasi amount: value dibatasi 0..target habit (clamp), completed di-set value>=target utk amount.

### GET /api/habits/batch-logs?month=yyyy-MM&ids=id1,id2 → { logs: HabitLog[] } (semua habit tercantum; id = semua habit aktif bila ids kosong)
### GET /api/habits/[id]/time-analysis?period=thisWeek|lastWeek|thisMonth|thisYear → { habit: {id,name,emoji,trackTime}, stats: {totalMinutes, avgMinutes, count, vsPrevious}, byDay: [{date:'yyyy-MM-dd', minutes, count}] } (guard habit.trackTime → 400 "Habit ini tidak mencatat waktu"; server-bandingkan YMD pakai `l.date.toISOString().slice(0,10)` BUKAN format() TZ server)
### GET /api/habits/[id]/year-logs?year=yyyy → { logs: HabitLog[] }

### GET /api/daily-logs?date=yyyy-MM-dd → DailyLog | null (validasi ketat 400 untuk date invalid seperti 2026-02-31)
PUT /api/daily-logs { date, mood?, energy?, sleep?, notes? } → DailyLog (upsert; partial — menyimpan notes saja TIDAK me-reset mood/energi/tidur)
GET /api/daily-logs?month=yyyy-MM → { logs: DailyLog[] } (jika param month dipakai)

### GET /api/dashboard?period=7|30|90 → payload dashboard:
```
{
  greeting: { userName },
  kpi: {
    totalHabits, activeToday, successToday (pct hari ini), weeklyRate, monthlyRate,
    consistencyScore, bestStreak, totalXp, currentLevel,
    moodAvg, sleepAvg, energyAvg, todayXp,
    completion7d, completion30d
  },
  bestHabit: { id, name, emoji, rate } | null,
  worstHabit: { id, name, emoji, rate } | null,
  weeklyChart: [{date:'yyyy-MM-dd', completed, missed}],  // 7 hari
  monthlyChart: [{date, completed, missed}],              // 30 hari
  categoryChart: [{category, count}],                     // performa kategori habit
  focusToday: [{ id, name, emoji, completed }],           // habit aktif hari ini
  lastDone: [{ id, name, emoji, lastDate, streak }],
  timeTracked: [{ id, name, emoji, minutes }],
  quote: { text, author },
  financeOverview: { monthIncome, monthExpense, monthNet, budgetTotal, budgetSpent }
}
```
Level/XP: totalXp = SUM(xp difficulty dari semua HabitLog completed all-time); currentLevel = calcLevel(totalXp) dari `@/lib/dashboard-helpers`.

### GET /api/goals → { goals: Goal[] } (Goal = {id,title,description,priority,deadline,milestones: [{text,done}],status,createdAt,updatedAt} — milestones diparse JSON)
POST /api/goals → Goal ; PUT /api/goals/[id] → Goal ; DELETE /api/goals/[id] → {ok:true}

### GET /api/finance/transactions?month=yyyy-MM(&type=&category=&search=&limit=500) → { transactions: Transaction[], totalIncome, totalExpense }
POST /api/finance/transactions { type, amount, category, sourceId?, description, notes?, tags? (array|string koma), date: 'yyyy-MM-dd', time?: 'HH:mm' } → Transaction (date + time → 12:00Z-ish date; transaction future diizinkan)
PUT /api/finance/transactions/[id] → Transaction ; DELETE — transfer dihapus berpasangan atomik (cari transferPairId → hapus keduanya dalam transaction)
POST /api/finance/transactions/bulk-delete { ids: string[] } → { deleted: n }
POST /api/finance/transactions/split { baseId, rows: [{category, amount}] } → { created: n } (pecah 1 transaksi jadi N)

### GET /api/finance/sources → { sources: FundSource[] } (balance = initialBalance + income − expense + transfer masuk − transfer keluar; exclude type='transfer' dari income/expense)
POST/PUT/DELETE /api/finance/sources(/[id]) — CRUD sumber
POST /api/finance/transfer { fromSourceId, toSourceId, amount, date, description?, fee? } → 2 Transaction pasangan (type='transfer', transferPairId saling menunjuk; fee optional transaction expense terpisah)

### GET /api/finance/categories → { categories: FinanceCategory[] }
POST/PUT /api/finance/categories/[id] (PUT rename cascade TIDAK perlu — kategori tx disimpan by-name; rename harus cascade updateMany Transaction.category + WeeklyBudget.category)
DELETE — tolak 400 bila masih dipakai transaksi ("Kategori masih dipakai N transaksi")

### GET /api/finance/budgets?month=yyyy-MM → { budgets: BudgetItem[] } (spent dihitung dari transaksi bulan itu per kategori; remaining = amount−spent; pct)
POST/PUT/DELETE /api/finance/budgets(/[id])

### GET /api/finance/savings-goals → { goals: SavingsGoal[] }
POST /api/finance/savings-goals ; PUT /api/finance/savings-goals/[id] (body penuh) ; PUT /api/finance/savings-goals/[id] body {delta} (endpoint quick-chip: currentAmount += delta, clamp 0..target, set completedAt bila capai) ; DELETE

### GET /api/finance/recurring → { recurring: RecurringTransaction[] }
POST/PUT/DELETE /api/finance/recurring(/[id])
POST /api/finance/recurring/[id]/process → buat 1 transaksi instance (guard race: updateMany lastRun CAS — hanya 1 panggilan paralel yang berhasil) 

### GET /api/finance/rules → { rules: TransactionRule[] }
POST/PUT/DELETE /api/finance/rules(/[id])

### GET /api/finance/dashboard?month=yyyy-MM → { monthIncome, monthExpense, monthNet, byCategory: [{category, amount, emoji, color}], byDay: [{date, amount}], dailyAvg, projection, noSpendDays, topCategory }
### GET /api/finance/daily-recap?date=yyyy-MM-dd → { transactions: Transaction[], totalExpense, totalIncome } (transaksi hari itu)

### GET /api/habit-options?type=category|priority|difficulty → { options: HabitOption[] }
POST /api/habit-options ; PUT /api/habit-options/[id] (rename label → CASCADE updateMany Habit.category/priority/difficulty yang cocok + 404 bila option tidak ada) ; DELETE
### GET/POST /api/habit-groups ; PUT/DELETE /api/habit-groups/[id] (delete → groupId habit di-set null dulu)

### GET /api/data/export → { data: { habits, habitLogs, dailyLogs, transactions, fundSources, financeCategories, weeklyBudgets, savingsGoals, recurringTransactions, transactionRules, goals, habitOptions, habitGroups, appSettings } }
POST /api/data/import { data } → restore (deleteMany semua tabel lalu insert; validasi allow-list keys; invalid JSON → 400)
POST /api/data/reset-all → hapus semua data (habits+finance+goals), appSettings tetap
POST /api/data/seed → jalankan seed (guard: tolak bila sudah ada data)

### GET /api/motivational-quote → { text, author } (fallback statis Indonesia)

### GET /api/ai-insights → { insights: [{ id, type: 'mood'|'sleep'|'performance'|'streak'|'finance', title, text, habitId? }] } — SEMUA teks Indonesia; pakai z-ai-web-dev-sdk bila mau (LLM chat, model default) dengan fallback statis bila SDK gagal.

### GET /api/analytics/hourly-consistency?period=30 → { byHour: [{hour, count, rate}], periodStart, periodEnd } (jam diambil dari completedAt +07:00; rentang konsisten UTC-midnight: dateFromYMD(jakartaDateString()))

## Aturan eslint yang dihormati (worklog):
- react-hooks/refs: JANGAN assign `ref.current = fn` saat render — pakai `useRef(fn)` tanpa reassign, atau panggil langsung dalam effect.
- set-state-in-effect: jangan setState langsung di body useEffect tanpa guard; event handler > effect.
- Anti-pattern: JANGAN `<Card className="premium-card ...">` (cascade flat shadow) — pakai `<div className="premium-card ...">`.
- Semua UI bahasa Indonesia. Label bahasa Inggris = bug.
- aria-label untuk tombol ikon-saja. AlertDialog konfirmasi untuk hapus destruktif.
- TZ: jangan parseISO + format lokal untuk tanggal storage; konstruksi dari komponen YMD.
