# UI/UX Redesign — Rutina

Branch: `redesign/ui-ux-refresh`

## Design intent

Rutina is moving toward a calm, focused personal workspace. The interface uses a warm neutral canvas, restrained forest-green accents, clear type hierarchy, consistent borders, and fewer decorative effects. Color communicates state and focus rather than acting as decoration.

## Files changed

| File | Change |
|---|---|
| `src/app/globals.css` | Added a consolidated visual layer for light/dark tokens, surfaces, navigation, cards, icon consistency, motion, and responsive adjustments. |
| `src/components/app-shell/app-header.tsx` | Reworked header hierarchy, date treatment, spacing, and control sizing. Jakarta date behavior is preserved. |
| `src/components/app-shell/app-sidebar.tsx` | Updated brand block, navigation states, spacing, and sidebar surface. Navigation IDs, focus behavior, and responsive drawer mechanics are preserved. |
| `src/components/app-shell/app-tab-content.tsx` | Improved content gutters and centered maximum-width content frame. Pull-to-refresh and tab loading behavior are preserved. |
| `src/components/app-shell/app-bottom-nav.tsx` | Replaced the floating dock with a full-width, five-position mobile navigation bar: Hari Ini, Tracker, Tambah, Progres, and Keuangan. Existing tab IDs and quick-add actions are retained. |
| `src/components/app-shell/app-quick-action.tsx` | Updated quick-add menu surfaces and icon treatment; menu placement now clears the full navigation bar and device safe-area. |
| `src/components/app-shell/app-tab-registry.tsx` | Updated primary navigation icons to House, ListChecks, ChartNoAxesCombined, TreeDeciduous, Dumbbell, WalletCards, BriefcaseBusiness, and SlidersHorizontal. |
| `src/components/habit-tracker/dashboard.tsx` | Grouped Growth cards and Reflection/Wellness cards into responsive two-column regions on large screens; stacked on smaller screens. Data fetching and mutations are unchanged. |

## Icon system

- All Lucide SVG icons share a consistent 1.8 stroke, rounded caps/joins, and predictable hover/press feedback.
- Primary navigation uses updated semantic icons, while the existing Lucide icon family is retained to avoid adding a second icon dependency or increasing bundle weight.
- Quick-add actions use restrained semantic color surfaces rather than multi-stop gradient icon tiles.
- Keyboard focus remains visible on the new bottom navigation and quick-add actions.

## Motion system

- Replaced the nav icon bounce with a short settle motion.
- Replaced broad card entrance motion with a low-distance fade/translate treatment.
- Removed repeated flame, urgency, and glow pulses from shared UI hooks.
- Removed the mobile dock entrance animation.
- Quick-add menu uses a short, low-distance entrance transition.
- `prefers-reduced-motion` disables the new motion and icon-hover transforms.

## What deliberately did not change

- Database schema, migrations, and seed data.
- API routes, request/response contracts, and server-side calculations.
- Habit completion, avoid-habit, streak, XP, scheduling, and vacation logic.
- Finance transaction, budget, wallet, and recurring-payment logic.
- Store state, URL deep links, and tab IDs.
- Quick-add actions and their store triggers.
- Sidebar focus trap and keyboard handling.

## Validation status

- Re-read changed files from the branch after writes.
- Checked that visual class hooks exist in the stylesheet and consuming components.
- Checked navigation IDs and primary icon imports in the registry.
- Checked that all four tab destinations and the quick-add launcher are rendered in the five-position bottom bar.
- Checked that the quick-add menu retains its five actions and uses a CSS offset relative to the full nav height, including safe-area padding.
- Checked keyboard focus styling and reduced-motion overrides.

A complete `bun install`, `bun run lint`, and `bun run build` has **not** been run in this environment. Do not treat this UI branch as a production-build-verified release until CI or a local environment runs those checks and the desktop/mobile screens are visually reviewed.

## Review checklist

- [ ] Desktop: sidebar open/closed and all main tabs.
- [ ] Mobile: 320px, 360px, 375px, 390px and 430px viewport widths.
- [ ] Dark mode: sidebar, cards, forms, dialogs, charts, and bottom navigation.
- [ ] Keyboard: sidebar focus trap, Escape close, quick-add menu focus.
- [ ] Test each quick-add action: habit, expense, income, task, transfer.
- [ ] Verify bottom navigation does not overlap page content or OS gesture area.
- [ ] Habit completion and finance actions still mutate as before.
- [ ] No horizontal overflow in Tracker, Finance, Calendar, Gym, and Work.
