# 🌱 Rutina — Habit & Finance Tracker

A personal habit-tracking and personal-finance web app built with Next.js 16, Prisma, and Tailwind CSS. Tracks daily habits (binary, avoid-style, and quantitative "amount" goals), daily mood/energy/sleep check-ins and journal notes, goals with milestones, XP/level gamification, and income/expense transactions with budgeting.

> Built by Ananda Tegar.

---

## ✨ Features

- **Habit tracking** — three habit types: normal (checklist), avoid ("don't do this" — streak counts clean days), and amount (quantitative daily goal with a −/+ stepper, e.g. "drink 8 glasses"). Categories, priorities, difficulties, time-tracked habits, habit groups, vacation mode, drag-to-reorder.
- **Daily check-in & journal** — 1-tap mood (1–5), energy (1–5), sleep hours (±0.5) plus rich-text daily notes (auto-saved). Feeds the dashboard mood/sleep KPIs and the calendar's mood emoji.
- **Calendar view** — completion history at a glance; tap a day to jump straight to that day's tracker grid.
- **Goals** — milestones, deadlines, progress tracking.
- **Gamification** — per-habit streaks & milestone celebrations, difficulty-based XP, an all-time Level (same scale on dashboard & tracker).
- **Finance tracker** — income/expense transactions (split, transfer, tags), fund sources (wallets) with balance history & net worth, monthly + weekly budgets with snapshots, savings goals, recurring transactions, auto-categorization rules, spending heatmap, category explorer, daily recap with projections.
- **AI Insights** — pattern analysis of your habit data.
- **Dashboard** — combined habit + finance overview with 1-click navigation into every area.
- **PWA** — installable, service worker with smart asset caching (a full offline data layer is on the roadmap).
- **Dark mode** — system / light / dark.
- **Jakarta timezone-aware** — date boundaries use Asia/Jakarta (UTC+7).
- **App lock** — optional PIN (PBKDF2) + WebAuthn/biometric privacy lock.

---

## 🛠 Tech Stack

| Layer       | Choice                                            |
|-------------|---------------------------------------------------|
| Framework   | Next.js 16 (App Router)                           |
| Language    | TypeScript 5                                      |
| Styling     | Tailwind CSS 4 + shadcn/ui (New York)             |
| Database    | Prisma 6 ORM (SQLite local / Turso production)    |
| State       | Zustand (client)                                  |
| Charts      | Recharts                                          |
| AI          | z-ai-web-dev-sdk                                  |
| Validation  | Zod                                               |
| Package mgr | bun (primary) — `bun.lock` is the source of truth |

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (for Next.js)
- [bun](https://bun.sh/) (primary package manager & runtime)
- A SQLite-compatible environment (built-in on most systems)

### Install & Run

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and configure (see below)
cp .env.example .env.local

# 3. Generate Prisma client
bun run db:generate

# 4. Create local SQLite database + tables
bun run db:push

# 5. (Optional) Seed default badges, rewards, sample transactions
curl -X POST http://localhost:3000/api/seed

# 6. Start dev server
bun run dev
```

Open `http://localhost:3000` in your browser.

---

## 🔧 Environment Variables

All secrets go in `.env.local` (NEVER commit `.env` or `.env.local` — they are gitignored).

| Variable                | Required | Description                                                              |
|-------------------------|----------|--------------------------------------------------------------------------|
| `DATABASE_URL`          | Yes      | SQLite path or Turso libsql URL. Default: `file:./db/dev.db`             |
| `DATABASE_AUTH_TOKEN`   | Turso only | Auth token for Turso cloud DB.                                         |
| `APP_API_KEY`           | No       | If set, all `/api/*` requests require an `x-api-key` header (see Security). |
| `TURSO_DATABASE_URL`   | Optional | Read by `scripts/sync-turso.ts` only. |
| `TURSO_AUTH_TOKEN`     | Optional | Read by `scripts/sync-turso.ts` only. |

See [`.env.example`](./.env.example) for a full template.

---

## 🔒 Security

### API authentication

This app has **no built-in user authentication**. It is designed as a single-user personal app. To prevent unauthorized access when deployed publicly:

1. Generate a strong random key:
   ```bash
   openssl rand -hex 32
   ```
2. Set `APP_API_KEY` in your hosting provider's env vars — the middleware (`src/middleware.ts`) then requires an `x-api-key` header (or `?apiKey=`) on **every** `/api/*` request.

⚠️ **Honest limitation:** the bundled web frontend does **not yet attach** the `x-api-key` header to its own API calls, so setting `APP_API_KEY` will currently lock out the app's own UI (401s). Until client-side key support ships (roadmap), protect a public deployment at the edge instead — e.g. Vercel Password Protection or a Basic-Auth layer in front of the whole app.

When `APP_API_KEY` is **not set** (e.g. local dev), the API is open. This is intentional for development convenience — **do not deploy publicly without edge protection**.

> Note: `/api/learning/article` (Z.AI SDK) exists as a backend endpoint but has no UI consumer yet.

### Sensitive files

The following files are gitignored and must never be committed:
- `.env`, `.env.local`, `.env.*` (except `.env.example`)
- `db/*.db`, `db/*.db-journal` (your actual database with real data)
- `*.log`, `dev.log`

If you accidentally commit any of these, remove them with `git rm --cached <file>` and consider history cleanup (BFG Repo-Cleaner) if secrets were involved.

---

## 📦 Database Management

We use Prisma with `db push` for prototyping and `prisma migrate` for production schema changes.

### Common commands

```bash
# Generate Prisma client (after schema changes)
bun run db:generate

# Push schema changes to local SQLite (no migration files)
bun run db:push

# Create a migration file (recommended for production)
bun run db:migrate

# Reset database (DESTRUCTIVE — drops all data)
bun run db:reset
```

### Schema changes

1. Edit `prisma/schema.prisma`.
2. Run `bun run db:push` locally to apply.
3. Test thoroughly.
4. For production, run `prisma migrate deploy` during your deploy step.

> ⚠️ Do NOT use raw `ALTER TABLE` SQL in API routes. All schema changes must go through Prisma migrations. The legacy `ensure-columns.ts` and `/api/migrate` routes have been removed.

---

## 🌐 Deployment (Vercel + Turso)

### 1. Database (Turso)

1. Create a free Turso account at https://turso.tech.
2. Create a database:
   ```bash
   turso db create habit-tracker
   turso db show habit-tracker --url      # → DATABASE_URL
   turso db tokens create habit-tracker   # → DATABASE_AUTH_TOKEN
   ```
3. Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in Vercel env vars.

### 2. App (Vercel)

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variables:
   - `DATABASE_URL` (Turso URL)
   - `DATABASE_AUTH_TOKEN` (Turso token)
   - `APP_API_KEY` — ⚠️ read Security first: the bundled UI does not send this key yet, so with it set the app's own UI gets 401s. Prefer Vercel Password Protection (or a Basic-Auth edge layer) until client key support ships.
4. Deploy.
5. After the first deploy, optionally send a POST to `/api/seed` once to populate default categories, habit options, and sample data. In production this requires the `x-api-key` header (see Security).

### 3. Schema on Turso

There is **no Prisma migrations folder yet** — dev uses `prisma db push`, and the production schema is synced to Turso with the manual, additive-only script:

```bash
bun run turso:sync   # reads TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
```

Destructive/renaming schema changes must currently be applied by hand on Turso. Real `prisma migrate` adoption is on the roadmap.

---

## 🧰 Available Scripts

| Script            | Description                                  |
|-------------------|----------------------------------------------|
| `bun run dev`     | Start dev server on port 3000                |
| `bun run build`   | Build for production                         |
| `bun run start`   | Start production server                      |
| `bun run lint`    | Run ESLint                                   |
| `bun run db:push` | Push schema to DB (no migration files)       |
| `bun run db:generate` | Regenerate Prisma client                 |
| `bun run db:migrate` | Create & apply a migration               |
| `bun run db:reset` | Reset DB (DESTRUCTIVE)                      |

---

## 📁 Project Structure

```
prisma/
  schema.prisma         # Database schema (single source of truth)

src/
  app/
    api/                # API routes (REST-ish)
      habits/           # Habit CRUD + logs
      finance/          # Transactions, sources, budgets, categories
      dashboard/        # Combined dashboard data
      ai-insights/      # Pattern analysis
      learning/         # AI article generation (Z.AI SDK, backend only)
      data/             # CSV/JSON import/export
      ...
    page.tsx            # Main app shell (single-page, tab-based)
    layout.tsx          # Root layout (theme, toaster, SW)
    error.tsx           # Error boundary
    loading.tsx         # Loading fallback
  components/
    habit-tracker/      # Feature components (dashboard, finance, etc.)
    ui/                 # shadcn/ui primitives
  hooks/                # Custom React hooks
  lib/
    db.ts               # Prisma client (lazy singleton)
    mood.ts             # Mood/energy scales shared by tracker + calendar
    money.ts            # Money parsing/formatting (Int-based)
    timezone.ts         # Jakarta timezone helpers
    validation.ts       # Zod schemas for API input
    utils.ts            # cn() and other small utilities
  store/
    app-store.ts        # Zustand global store (1-click deep links)
  middleware.ts         # API auth middleware
```

---

## 🤝 Contributing

This is a personal project. If you'd like to suggest changes, please open an issue first.

---

## 📝 License

All rights reserved. This source is provided for review only.
