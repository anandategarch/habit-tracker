# 🌱 Rutina — Habit & Finance Tracker

A personal habit-tracking and personal-finance web app built with Next.js 16, Prisma, and Tailwind CSS. Tracks daily habits, moods, journals, goals, challenges, badges, rewards, learning topics, and income/expense transactions with budgeting.

> Built by Ananda Tegar.

---

## ✨ Features

- **Habit tracking** — daily/weekly/monthly targets, categories, priorities, difficulties, time-tracked habits, habit groups.
- **Calendar view** — see completion history at a glance.
- **Goals & Challenges** — milestones, deadlines, progress tracking.
- **Badges & Rewards** — gamification with XP and unlockable rewards.
- **Finance tracker** — income/expense transactions, fund sources (wallets), budgets per category, analytics.
- **Journal** — daily reflection with mood, stress, energy, sleep tracking.
- **Learning hub** — AI-generated articles on finance topics (powered by Z.AI SDK).
- **AI Insights** — pattern analysis of your habit data.
- **Dashboard** — combined habit + finance overview.
- **PWA** — installable, offline-capable (service worker).
- **Dark mode** — system / light / dark.
- **Jakarta timezone-aware** — date boundaries use Asia/Jakarta (UTC+7).

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
| `APP_API_KEY`           | No       | If set, all `/api/*` requests require `x-api-key` header. See Security. |
| `NEXT_PUBLIC_APP_API_KEY` | No     | Same value as `APP_API_KEY`, exposed to browser for the `apiFetch` helper. |

See [`.env.example`](./.env.example) for a full template.

---

## 🔒 Security

### API authentication

This app has **no built-in user authentication**. It is designed as a single-user personal app. To prevent unauthorized access when deployed publicly:

1. Generate a strong random key:
   ```bash
   openssl rand -hex 32
   ```
2. Set `APP_API_KEY` (and `NEXT_PUBLIC_APP_API_KEY` with the same value) in your hosting provider's env vars.
3. The frontend's `apiFetch` helper (in `src/lib/api-client.ts`) will automatically attach the key as the `x-api-key` header on every request.

When `APP_API_KEY` is **not set** (e.g. local dev), the API is open. This is intentional for development convenience — **do not deploy to production without setting `APP_API_KEY`**.

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
   - `APP_API_KEY` (generate with `openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_API_KEY` (same value as `APP_API_KEY`)
4. Deploy.
5. After first deploy, send a POST to `/api/seed` once to populate default badges/rewards/categories.

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
  seed-options.ts       # Default seed data

src/
  app/
    api/                # API routes (REST-ish)
      habits/           # Habit CRUD + logs
      finance/          # Transactions, sources, budgets, categories
      dashboard/        # Combined dashboard data
      ai-insights/      # Pattern analysis
      learning/         # AI article generation (Z.AI SDK)
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
    money.ts            # Money parsing/formatting (Int-based)
    timezone.ts         # Jakarta timezone helpers
    validation.ts       # Zod schemas for API input
    api-client.ts       # Frontend fetch wrapper (auto API key)
    utils.ts            # cn() and other small utilities
  store/
    app-store.ts        # Zustand global store
  middleware.ts         # API auth middleware
```

---

## 🤝 Contributing

This is a personal project. If you'd like to suggest changes, please open an issue first.

---

## 📝 License

All rights reserved. This source is provided for review only.
