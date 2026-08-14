---
name: tripflow-ui
description: Build or change TripFlow UI so it matches the Rail & Ledger design system in `.design/tripflow-ui-2.0/`. Use when implementing a designed screen or component, closing a gap between the shipped app and the design, or reviewing whether a UI change is faithful to it. Enforces token-only styling, the two signature structures, and browser verification against live data.
---

# TripFlow UI

Implement the design in `.design/tripflow-ui-2.0/` faithfully in React Native. The design is the contract; the app is behind it in known places.

## Preflight

1. Read `AGENTS.md` and `PROJECT_CONTEXT.md`. The shared Git workflow and component-boundary rules apply here without exception.
2. Read `.design/tripflow-ui-2.0/README.md`, then regenerate the viewable pages — they are gitignored, so a fresh checkout has none:
   ```bash
   node .design/tripflow-ui-2.0/build.mjs
   ```
3. Open the page you are implementing against. `src/*.html` are the editable sources; the built files at the bundle root are what you look at.
4. Read `src/constants/theme.ts` in full before styling anything.

## The design in one paragraph

The interface is a neutral grey field. Colour is spent on exactly one primary action per screen and on status — nothing else. The itinerary is one continuous time rail: times sit in a fixed 46pt gutter so every title starts on the same axis, and travel occupies the gap *between* two plans rather than nesting inside a row. Settlement is one bipolar balance bar, not a grid of equal-weight metrics. Money states a direction, never a severity.

## Non-negotiable rules

These come from `foundations.html`. A change that breaks one is wrong even if it looks fine.

1. **One route rule.** One primary action per surface. Everything else is secondary or ghost. Surfaces themselves carry no hue.
2. **Travel lives in the gap.** Never nest a route estimate, mode switcher, or transit plan inside the row of the plan being travelled to.
3. **Money has direction, not severity.** `moneyOut` for what you owe, `moneyIn` for what is owed to you. `danger` is reserved for errors and destructive actions. A pending payment is not an error.
4. **Confirm at the moment of impact.** Date changes, amount changes, membership changes, and deletions confirm before commit and stay reversible.
5. **Two languages, one layout.** Chinese and English differ in length; absorb it with wrapping and hug sizing, never truncation.
6. **Grouping before cards.** Spacing and tonal surfaces group first. Cards are the last resort; the rail stays flat.
7. **Colour never carries meaning alone.** Every money figure and every kind pill keeps its label.

## Token discipline

**Never write a colour literal in `src/`.** Every colour comes from `useTheme()`, whose keys match `.design/tripflow-ui-2.0/src/tokens.css` one-for-one.

Three literals are deliberate and documented — leave them: the invite QR foreground/background pair (must stay fixed dark-on-white to remain scannable), the camera viewport behind the scanner finder, and the splash overlay (belongs to `app.json` branding).

**Never branch on the active colour scheme.** No `theme.background === '#0F1413'`, no `useColorScheme()` inside a component to pick a colour. If a value differs between themes, it is a missing token — add it to both palettes in `theme.ts`. `Colors` is `as const`, so a stale literal comparison becomes a compile error rather than a silent dark-mode regression; that is the point.

Numeric tokens live beside the colours:

| Design token | Code |
| --- | --- |
| `--space-*` | `Spacing.*` |
| `--radius-*` | `Radius.*` |
| `--size-*` | `Size.*` |

Use them instead of literals in new code. Existing files still carry hardcoded numbers; convert the ones you touch, not the whole file.

## Structures to reuse, not re-derive

| Design pattern | Component |
| --- | --- |
| Time rail row, day separator, route gap | `src/components/timeline-rail.tsx` |
| Route estimate chip, Maps link, transit plan | `src/components/route-plan.tsx` |
| Bipolar money summary | `src/components/balance-bar.tsx` |
| Buttons, chips, fields, notices | `src/components/form-controls.tsx` |

The rail's vertical rhythm belongs on the **content column**, never on the row container — padding on the container sits outside the spine column and breaks the line. Rows also draw a short stub above the dot so the spine stays continuous across rows. If you add a rail element, measure the spine, do not eyeball it.

## Component boundaries

`src/app/index.tsx` and `src/app/ledger.tsx` are past the 500-line boundary `AGENTS.md` sets. Adding a designed structure to them means **extracting**, not appending: build the pattern as a focused component under `src/components/` and have the screen shrink or hold steady. Check the line count before and after and state both.

Pure logic behind a visual (proportions, formatting, thresholds) goes in `src/lib/` with a test beside it. Jest here only transforms plain `.ts` — importing a `.tsx` pulls in the React Native transform chain that every existing suite avoids, and the suite will fail to run.

## Verification

Static gates are necessary, not sufficient:

```bash
npm run lint && npm run typecheck && npm test
```

Then verify in a browser against **live data**, because most of this design only renders with a real trip:

```bash
# .env.local needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
node .design/tripflow-ui-2.0/build.mjs   # if comparing against the design
```

Start the dev server through the preview tooling, never a bare shell. Then:

1. Sign in **on the dev-server origin**. A session on the production domain does not carry over, and an emailed magic link redirects to the production Site URL — use password sign-in or paste only the code.
2. Check 375px and a desktop width, in light and dark.
3. Read console errors. Ignore entries produced while a file held conflict markers during a rebase; confirm by reloading and checking the count does not grow.
4. Measure geometry that the design specifies (rail continuity, gutter alignment, bar proportions) with `getBoundingClientRect` rather than judging by eye. Alignment defects of 10–25px are invisible in a screenshot and obvious in numbers.

State plainly what you could **not** verify. Common gaps: a trip with no outstanding balance never renders the balance bar's fill; a single later plan never renders the day separator; an unavailable route estimate never renders the transit plan.

## Traps already hit here

- **Paint-level opacity is unreliable on variable-bound fills.** Use a real tint token, not an alpha on the accent.
- **A pixel `flexBasis` becomes a height when a row flips to `column`.** Any child of a container with a `*Compact: { flexDirection: 'column' }` variant must reset to `flexGrow: 0, flexBasis: 'auto'`.
- **`main` moves under you.** Other agents work in parallel worktrees on the same files. Rebase before pushing, resolve by keeping both sides' behaviour, and re-verify in the browser — a clean textual auto-merge of `ledger.tsx` does not mean the other agent's composer still works.
- **A cancelled CI run reports as `fail`.** After a force-push, check the newest run, not the rollup.

## Where the design and the app still differ

Kept current in `.design/tripflow-ui-2.0/README.md`. Read it before starting; update it when you close a gap.
