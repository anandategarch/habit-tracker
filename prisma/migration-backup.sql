-- ─────────────────────────────────────────────────────────────────────
-- Migration: Add dailyBudgetTarget column to AppSettings
-- Date: 2026-07-31
--
-- Run this in Turso web console if `prisma db push` in Vercel build fails.
--
-- Turso console: https://app.turso.tech → select your DB → "Console" tab
-- Paste this entire file, click "Run".
--
-- Safe: additive column with default value, no data loss.
-- ─────────────────────────────────────────────────────────────────────

-- Add the dailyBudgetTarget column (0 = not set, ring hidden in UI).
-- SQLite/Turso uses INTEGER for Prisma's Int type.
ALTER TABLE AppSettings ADD COLUMN dailyBudgetTarget INTEGER NOT NULL DEFAULT 0;

-- Verify the column was added (should show dailyBudgetTarget in the list).
-- Uncomment to run:
-- PRAGMA table_info(AppSettings);
