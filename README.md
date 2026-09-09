# 🌱 Rutina — Habit & Finance Tracker

A personal habit-tracking and personal-finance web app built with Next.js 16, Prisma, and Tailwind CSS. Tracks daily habits (binary, avoid-style, and quantitative "amount" goals), daily mood/energy/sleep check-ins and journal notes, goals with milestones, XP/level gamification, and income/expense transactions with budgeting.

> Built by Ananda Tegar.

---

## ✨ Features

- **Habit tracking** — three habit types: normal (checklist), avoid ("don't do this" — streak counts clean days), and amount (quantitative daily goal with a −/+ stepper, e.g. "drink 8 glasses"). Categories, priorities, difficulties, time-tracked habits, habit groups, vacation mode, drag-to-reorder.
- **Daily check-in & journal** — 1-tap mood (1–5), energy (1–5), sleep hours (±0.5) plus daily notes. Feeds the dashboard mood/sleep KPIs and the calendar's mood emoji.
- **Calendar view** — completion history at a glance; tap a day to jump straight to that day's tracker grid.
- **Goals** — milestones, deadlines, progress tracking.
- **Gamification** — per-habit streaks & milestone celebrations, difficulty-based XP, an all-time Level (same scale on dashboard & tracker).
- **Finance tracker** — income/expense transactions (split, transfer, tags), fund sources (wallets) with balance history & net worth, monthly + weekly budgets with snapshots, savings goals, recurring transactions, auto-categorization rules, spending heatmap, category explorer, daily recap with projections.
- **AI Insights** — pattern analysis of your habit data.
- **Dashboard** — combined habit + finance overview with 1-click navigation into every area.
- **PWA** — installable, service worker with smart asset caching (a full offline data layer is on the roadmap).
- **Dark mode** — system / light / dark.
- **Jakarta timezone-aware** — date boundaries use Asia/Jakarta (UTC+7).

---

## 🛠 Tech Stack

| Layer       | Choice                                            |
|-------------|---------------------------------------------------|
| Framework   | Next.js 16 (App Router)                           |
| Language    | TypeScript 5                                      |
| Styling     | Tailwind CSS 4 + shadcn/ui (New York)             |
| Database    | Prisma 6 ORM + libsql driver adapter (SQLite local / Turso production) |
| State       | Zustand (client)                                  |
| Charts      | Recharts                                          |
| AI          | z-ai-web-dev-sdk (server-side only)               |
| Validation  | Zod                                               |
| Package mgr | bun (primary) — `bun.lock` is the source of truth |

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- [bun](https://bun.sh/) (primary package manager & runtime)
- A SQLite-compatible environment (built-in on most systems)

### Install & Run

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and configure
cp .env.example .env          # lalu edit DATABASE_URL bila perlu

# 3. Generate Prisma client (driver adapter libsql)
bun run db:generate

# 4. Create local SQLite database + tables
mkdir -p db && bun run db:push

# 5. (Optional) Seed demo data realistis (6 habit, 30 hari log, transaksi, goal)
bun scripts/seed.ts

# 6. Start dev server
bun run dev
```

Open `http://localhost:3000` in your browser.

---

## 🔧 Environment Variables

All secrets go in `.env` / `.env.local` (NEVER commit them — they are gitignored).

| Variable                | Required | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `DATABASE_URL`          | Yes      | SQLite path (`file:./db/dev.db`) or Turso URL (`libsql://…`). One code path for both. |
| `DATABASE_AUTH_TOKEN`   | Turso only | Auth token for Turso cloud DB.                                            |
| `TURSO_DATABASE_URL`    | For `turso:push` only | Target DB for `bun run turso:push` (usually the Turso libsql URL). |
| `TURSO_AUTH_TOKEN`      | For `turso:push` only | Token for `turso:push`. |

See [`.env.example`](./.env.example) for a full template.

---

## 🔒 Security

**This app has no built-in user authentication and no API key middleware** — it is a
single-user personal app. The API (including the destructive `POST /api/reset-all`)
is open whenever it runs.

If you deploy it to a public URL:

1. **Enable Vercel Password Protection** (Pro plan) on the deployment, **or**
2. Put a Basic-Auth edge layer in front of the whole app (e.g. a proxy), **or**
3. Keep the deployment URL private and unshared.

Do not deploy publicly without one of the above — anyone with the URL can read and
wipe your data.

### Sensitive files

The following are gitignored and must never be committed:
- `.env`, `.env.local`, `.env.*` (except `.env.example`)
- `db/*.db` (your actual database with real data)
- `*.log`, `dev.log`

---

## 📦 Database Management

Dev uses Prisma `db push` (no migration files). The runtime client goes through the
**libsql driver adapter** (`@prisma/adapter-libsql`), so the exact same code path works
against a local SQLite file and against Turso.

### Common commands

```bash
bun run db:generate      # regenerate Prisma client (after schema changes)
bun run db:push          # push schema changes to the local SQLite file
bun run db:reset         # reset local DB (DESTRUCTIVE)
bun run turso:push       # sync schema.prisma → Turso (idempotent, delta-based)
bun scripts/seed.ts      # seed demo data (respects DATABASE_URL env)
```

`turso:push` reads the remote schema via `sqlite_master`, computes the delta with
`prisma migrate diff`, and applies only what changed — safe to re-run. Removing a
model from `schema.prisma` produces a `DROP TABLE` on the remote, so back up first.

---

## 🌐 Deployment (Vercel + Turso)

> `next.config.ts` disables `output: "standalone"` when `VERCEL=1` (set automatically
> by Vercel). Standalone output is for self-hosting only — on Vercel it crashes the
> build with `ENOENT .next/next-server.js.nft.json` (vercel/next.js#96657).

### 1. Database (Turso)

1. Create a free Turso account at https://turso.tech and install the CLI.
2. Create a database:
   ```bash
   turso db create rutina
   turso db show rutina --url      # → libsql://…  (DATABASE_URL)
   turso db tokens create rutina   # → DATABASE_AUTH_TOKEN
   ```
3. Create the schema + demo data from your machine:
   ```bash
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="eyJ…" bun run turso:push
   DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="eyJ…" bun scripts/seed.ts   # opsional
   ```

### 2. App (Vercel)

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variables:
   - `DATABASE_URL` — the Turso `libsql://…` URL
   - `DATABASE_AUTH_TOKEN` — the Turso token
4. Deploy — `prisma generate && next build` (from `vercel.json`) runs automatically.

Protect the deployment as described in **Security** above.

---

## 🧰 Available Scripts

| Script            | Description                                  |
|-------------------|----------------------------------------------|
| `bun run dev`     | Start dev server on port 3000                |
| `bun run build`   | Build for production (standalone, self-host) |
| `bun run start`   | Start production server (standalone)         |
| `bun run lint`    | Run ESLint                                   |
| `bun run db:push` | Push schema to local DB (no migration files) |
| `bun run db:generate` | Regenerate Prisma client                 |
| `bun run turso:push` | Sync schema to Turso (idempotent)         |

---

## 📁 Project Structure

```
prisma/
  schema.prisma         # Database schema (single source of truth, driverAdapters)

scripts/
  seed.ts               # Demo data (habits, logs, transactions, goals)
  turso-push.ts         # Idempotent schema sync → Turso

src/
  app/
    api/                # API routes (habits, finance, dashboard, goals, ai-insights, data…)
    page.tsx            # Main app shell (single-page, tab-based)
    layout.tsx          # Root layout (theme, toaster, SW registration)
  components/
    habit-tracker/      # Feature components (dashboard, finance, tracker, settings…)
    ui/                 # shadcn/ui primitives
  hooks/                # Custom React hooks
  lib/
    db.ts               # Prisma client via libsql adapter (file: lokal / libsql:// Turso)
    money.ts            # Money parsing/formatting (Int-based)
    timezone.ts         # Jakarta timezone helpers
    validation.ts       # Zod schemas for API input
  store/
    app-store.ts        # Zustand global store (1-click deep links)
```

---

## 📝 License

All rights reserved. This source is provided for review only.
