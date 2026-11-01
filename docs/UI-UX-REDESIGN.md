# UI/UX Redesign — Rutina

Branch: `redesign/ui-ux-refresh`

## Design intent

The refresh moves Rutina toward a calm, focused personal workspace. The interface uses a warm neutral canvas, restrained forest-green accents, clear type hierarchy, consistent borders, and fewer decorative effects. Color communicates state and focus rather than acting as decoration.

## Files changed

| File | Change |
|---|---|
| `src/app/globals.css` | Added a consolidated visual layer for light/dark tokens, surfaces, navigation, cards, and responsive adjustments. Existing feature classes remain available. |
| `src/components/app-shell/app-header.tsx` | Reworked the header hierarchy, date treatment, spacing, and control sizing. Jakarta date behavior is preserved. |
| `src/components/app-shell/app-sidebar.tsx` | Updated brand block, navigation states, spacing, and sidebar surface. Navigation IDs, focus behavior, and responsive drawer mechanics are preserved. |
| `src/components/app-shell/app-tab-content.tsx` | Improved content gutters and added a centered maximum-width content frame. Pull-to-refresh and tab loading behavior are preserved. |
| `src/components/app-shell/app-bottom-nav.tsx` | Simplified the mobile dock surface and removed decorative glass shine/halo layers. FAB and menu behavior remain in place. |
| `src/components/habit-tracker/dashboard.tsx` | Grouped related Growth cards and Reflection/Wellness cards into responsive two-column regions on large screens; stacked on smaller screens. Data fetching and mutations are unchanged. |

## What deliberately did not change

- Database schema, migrations, and seed data.
- API routes, request/response contracts, and server-side calculations.
- Habit completion, avoid-habit, streak, XP, scheduling, and vacation logic.
- Finance transaction, budget, wallet, and recurring-payment logic.
- Store state, URL deep links, and tab IDs.
- Existing accessibility handling for drawer focus, keyboard navigation, and reduced motion.

## Validation status

- Re-read the changed files from this branch after each write.
- Checked that new UI class hooks exist in the stylesheet and consuming components.
- Checked that dashboard grid wrappers open and close around the intended feature groups.
- Checked that the header retains its Jakarta date calculation and existing sidebar toggle API.
- Checked that the app shell retains PullToRefresh, PageTransition, and the existing active tab registry.

A complete `bun install`, `bun run lint`, and `bun run build` has **not** been run in this environment: the shell cannot resolve `github.com`, so the repository could not be cloned for a local build. Do not treat this UI branch as a production-build-verified release until CI or a local environment runs those checks and the desktop/mobile screens are visually reviewed.

## Review checklist

- [ ] Desktop: sidebar open/closed and all main tabs.
- [ ] Mobile: 320px, 375px, 390px and 430px viewport widths.
- [ ] Dark mode: sidebar, cards, forms, dialogs, charts, and dock.
- [ ] Keyboard: sidebar focus trap, Escape close, FAB menu focus.
- [ ] Habit completion and finance actions still mutate as before.
- [ ] No horizontal overflow in Tracker, Finance, Calendar, Gym, and Work.
