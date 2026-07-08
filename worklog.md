---
Task ID: 1
Agent: Main
Task: Replace Journal with Daily Learning tab + improve Dashboard charts

Work Log:
- Read and analyzed current Journal component, app structure, Prisma schema, store, and page.tsx
- Updated Prisma schema: added LearningTopic model (name, emoji, order)
- Pushed schema to database with db:push
- Created 4 API endpoints:
  - GET/POST /api/learning/topics (list & create topics)
  - PUT/DELETE /api/learning/topics/[id] (edit & delete topics)
  - GET /api/learning/article (fetch article from web, summarize with LLM, fun fact, cache with refresh support)
  - GET/POST /api/learning/complete (get learning streak status, mark daily learning complete via habit log)
- Updated seed route to include 6 default learning topics (Akuntansi, Keuangan, Ekonomi, Pajak, Investasi, Manajemen)
- Updated app-store.ts: changed 'journal' TabId to 'learning'
- Updated page.tsx: replaced Journal import/component with Learning
- Created full Learning component (learning.tsx) with:
  - Topic selector pills (purple theme)
  - Article card with gradient header, content paragraphs, fun fact
  - Refresh button (bypasses daily cache)
  - "Selesai Baca" button (logs to habit tracker, shows "Sudah Selesai" when done)
  - Streak display (current + longest + total days)
  - Manage Topics dialog (add/edit/delete with emoji picker)
  - 18 fallback articles per topic (for when web fetch fails)
- Updated Dashboard API with new data:
  - learningStatus (completedToday, streak, longestStreak, totalDays)
  - habitDetailStats (per-habit completion rate, streak, done/total)
  - stackedBarData (completed vs missed per day)
  - weeklyPattern (completion rate by day of week, 30-day average)
- Updated Dashboard UI with:
  - Daily Learning status card (green when done, violet when pending)
  - Stacked bar chart showing completed vs missed habits per day
  - Weekly pattern bar chart showing which days user performs best
  - Per-habit performance table with progress bars and streak indicators
- Ran lint: 0 errors
- Pushed to GitHub with new token

Stage Summary:
- Journal tab fully replaced with Daily Learning tab
- Learning feature integrated with habit tracker system
- Dashboard significantly enhanced with 3 new chart sections + Daily Learning card
- All changes committed (6cb0b24) and pushed to GitHub