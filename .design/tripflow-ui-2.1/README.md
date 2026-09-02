# TripFlow UI 2.1 — "Plans and Assist"

An extension of [`../tripflow-ui-2.0/`](../tripflow-ui-2.0/README.md), not a replacement. Every token,
component and rule still comes from there; this bundle only covers the four surfaces that were built
**after** UI 2.0 shipped and therefore never had a design page:

| Surface | Code |
| --- | --- |
| Plans screen | `src/app/itinerary.tsx` |
| Branches | `src/components/segment-sheet.tsx` |
| Itinerary health | `src/components/itinerary-health-card.tsx` |
| Smart edit | `src/components/itinerary-edit-assistant.tsx` |

Each is drawn twice — as shipped, and as proposed — so a claim about the change can be checked rather
than believed.

## What is here

```
_tokens.css      values lifted one-for-one from src/constants/theme.ts and the shipped components
parts/*.html     the artboard bodies, edited by hand
canvas.json      artboard positions, pages, and the launch view
build.mjs        wraps each part in the Design Component shell with the tokens inlined
*.dc.html        built artboards
```

Rebuild after editing anything in `parts/` or `_tokens.css`:

```bash
node .design/tripflow-ui-2.1/build.mjs
```

Published canvas: <https://claude.ai/code/artifact/9222a13a-7c83-4a79-bdbe-2aab856c53fa>

## The four findings

Each is a violation of a rule UI 2.0 already wrote down, not a matter of taste.

### 1. Plans — five layers of chrome sit on top of the rail

`全部安排` carried an instructional sentence, the search box carried a field label above a 48pt input,
and the branch list carried its own section heading and a `ListSurface` — all above the first plan.
Every branched row then repeated a `分支 · 后半段` pill on a line of its own.

Measured on a 390×844 frame: the first plan row's top sat at **505px**, and **2** rows were fully
visible above the nav.

What changed:

- The section heading and its instructions are gone. The screen title already names the page and the
  context row already gives the count; `screen.tsx`'s own rule is title plus one context row.
- Search became a 40pt tonal field whose placeholder is its label.
- Branches became filter chips in that same row, with management behind a `管理分支` link. Selecting a
  branch narrows the rail.
- The per-row pill became a suffix on the meta line — one accent-weighted run reading `分支 后半段`,
  costing no extra height. Membership is still named, so colour never carries it alone.
- The `24/24` count renders only while a filter is active.

Measured after: first row top **260px**, **6** rows fully visible. `−245px`, `2 → 6`.

### 2. Branches — a list where a sheet belongs, and raw ISO dates

The row subtitle read `2026-03-12 — 2026-03-16`, while the Trips screen states the same kind of range
as `3月12 — 3月16`. Dissolving was a trailing link that turned into `确认解散` on first press and grew a
hint below the row, reflowing the list under the reader's thumb.

The list moved into a bottom sheet with stacked member avatars, a localized range from the new shared
`formatDayRange`, and the plan count. Dissolving opens inside that sheet: the consequence stated once
in a `danger` notice, then one destructive action. Nothing moves under a press.

### 3. Itinerary health — a bordered card holding bordered boxes

`foundations.html` says grouping comes from spacing and tonal surfaces, and that a surface never
combines a border with another. The card did both, three levels deep. Severity was stated three ways
(a dot, a type word, a severity word), and every issue grew one `修改「X」` link per affected plan — so a
two-plan conflict put four competing actions on one card, beside a filled secondary `重新检查` button.

The card became a tonal surface with a single 3px bar carrying the highest severity present — the
shape `InlineNotice` already uses. Issues are hairline-separated rows. Severity is one coloured dot
beside `类型 · 严重度`. Each issue has exactly one action: the row opens the first plan it names.
`重新检查` dropped to a text link, so the surface holds one path.

### 4. Smart edit — a container with a left accent rule, and two primaries at once

The collapsed hint was a 64pt block with a 3px accent bar; open, it became a panel with the same bar,
nested inside the composer sheet's own surface. Once a preview arrived, `生成预览` and `应用修改` were
both live `tone="primary"` buttons. The diff's label column was a hardcoded `44`, two pixels off the
46pt rail gutter every other surface aligns to.

Collapsed is now one text link. Open is a plain tonal block. Exactly one primary exists at a time:
`生成预览` until a proposal arrives, then `应用修改`, with regenerate and discard as links. The diff
label column is `46`, and before/after read as two lines rather than an arrow-prefixed string.

## Design vs. shipped app

| Design | Shipped | Where |
| --- | --- | --- |
| Plans header without the instructional section heading | ✅ shipped | `src/app/itinerary.tsx` |
| Compact search + branch filter chips + manage link | ✅ shipped | `src/components/plan-filter-bar.tsx` |
| Branch as a meta-line suffix, not a per-row pill | ✅ shipped | `src/components/timeline-rail.tsx` `branch` prop |
| Branch management as a sheet with a localized range | ✅ shipped | `src/components/segment-sheet.tsx`, `formatDayRange` in `src/lib/trip-time.ts` |
| Health as a tonal surface, one action per issue | ✅ shipped | `src/components/itinerary-health-card.tsx` |
| Smart edit: one primary at a time, 46pt diff gutter | ✅ shipped | `src/components/itinerary-edit-assistant.tsx` |

## What could not be verified here

The authenticated screens need a real Supabase project, and this checkout has no credentials, so the
Plans screen, the branch sheet, the health surface and the smart-edit panel were **not** opened
against live data. What was checked: `npm run lint`, `npm run typecheck`, 98 Jest tests, and a web
export whose static `/itinerary` route builds and loads with no console errors beyond the expected
placeholder-Supabase fetch failure. The `−245px / 2 → 6` figures are measured on the artboards with
`getBoundingClientRect`, not on the running app.

Before shipping, open a trip with at least one branch and confirm: the filter chips narrow the rail
and the count line appears; the branch suffix wraps rather than truncates in both languages; the
health surface renders with a real conflict and its row opens the right plan; the smart-edit panel
never shows two filled buttons at once.
