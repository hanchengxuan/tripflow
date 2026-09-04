# TripFlow UI 2.3 — "The rest of the app"

An extension of [`../tripflow-ui-2.0/`](../tripflow-ui-2.0/README.md),
[`../tripflow-ui-2.1/`](../tripflow-ui-2.1/README.md) and
[`../tripflow-ui-2.2/`](../tripflow-ui-2.2/README.md), not a replacement.

2.2 answered three questions the system had never written down: what a settings row looks like, what
its trailing element means, and how an irreversible action asks. This bundle applies those answers to
everything 2.2 did not reach — and closes the inconsistency 2.2 itself created.

| Surface | Code |
| --- | --- |
| Today's plan editor | `src/app/index.tsx` → `src/components/itinerary-composer-sheet.tsx` |
| Trips | `src/app/explore.tsx` |
| Sign-in, registration, 404 | `src/features/auth/auth-screen.tsx`, `src/app/+not-found.tsx` |
| Ledger · settle | `src/app/ledger.tsx` → `src/components/settlement-workspace.tsx` |
| Time zone and ledger currency | `src/features/trips/trip-defaults.ts`, `src/components/base-currency-sheet.tsx` |

No new rules. The three from 2.2 do all the work here:

1. **One row.** A trailing chevron means the row goes somewhere; a value or a control means it does
   not; a row that acts in place carries neither.
2. **Forms live in panels.** Nothing unfolds inside a page and pushes what is below it out from under
   the reader's thumb.
3. **One confirmation shape.** The consequence once, the thing being acted on named in its own terms,
   the destructive action prominent, 取消 last and separated.

## What is here

```
_tokens.css      values lifted one-for-one from src/constants/theme.ts
parts/*.html     the artboard bodies, edited by hand
canvas.json      artboard positions, pages, and the briefs
build.mjs        wraps each part in the Design Component shell, and lays them all out in preview.html
measure.mjs      reads figures off the built artboards with Chromium
*.dc.html        built artboards
preview.html     every artboard on one page — this is what gets published
```

```bash
node .design/tripflow-ui-2.3/build.mjs
```

Published canvas: <https://claude.ai/code/artifact/290a1417-21cd-4f84-b3f6-1cedabdef250>

## The four findings

### 1. Today kept its own copy of the plan editor

`index.tsx` carried a parallel composer — thirteen pieces of form state, its own submit, its own
delete confirmation. After 2.2 fixed the shared one, the two diverged visibly: the same plan opened
from 安排 got the new panel and from 今天 the old one, with the hand-rolled 48/12 danger Pressable and
the footer that swapped 保存 away. **This was 2.2's own doing** — the duplication predated it, the
visible split did not.

Today's three exclusive actions — open map, add the hotel transfer, move to another trip — are rows
in the shared sheet now. `index.tsx` drops from 857 to 544 lines.

One live defect fell out: route-mode changes wrote failures into the composer's error slot, which
only renders inside that sheet, so changing a travel mode from the timeline and failing said nothing.

### 2. Trips was the page 2.2 would have found next

Seven things unfolded inside it — create, join, edit, delete, change access, remove someone, invite —
under buttons that renamed themselves to 收起. A member row expanded into an access block and 移出此行程
expanded again inside that, pushing every row below down twice. Four button implementations sat on
one screen, two of them hand-rolled danger Pressables. Dates read `2026-03-12 — 2026-03-18` while
`formatTripRange` sat in the same file. A 20/26 section heading was hand-written twice in a file that
imports `SectionHeading` and uses it forty lines below.

The page is read-only now; every action opens a panel. `ConfirmSheet` is new here and carries all four
irreversible actions in the product, which is what removed the last two hand-rolled danger buttons.

### 3. Half the sign-in design had never been built

UI 2.0 designed this screen and its README recorded the change. Google's mark, the 或用邮箱 divider and
the lone 邮箱 chip were done. The half that was not is the one the design argued hardest for: the three
flow chips become bottom text links with the email-code path as the default. They were still above the
field. The code step stacked three full-width buttons, two of them filled secondary.

Also: 34/42 and 26/32 both leave the screen, registration setup stops using a table of contents as its
context row and a 116pt circle with text wrapping inside it as its avatar, and every legal link
becomes a 44pt row instead of `Link` wrapping a bare `Text`.

`+not-found.tsx` is new. Expo's unstyled English "Unmatched Route" was the 404 — a real gap for a
bilingual product on the web, and where an expired invite lands.

### 4. The ledger's settle view had been left behind by its own balance bar

The bar replaced four equal-weight metrics at the top of the page in UI 2.0. Group settlement still
gave every person, per currency, the same four. Tasks were wrap-flex rows with a 22/28 amount and the
product's sixth hand-rolled button; three more things unfolded in place.

Tasks are rows now, with the amount as a trailing value in `moneyOut` and a real `ActionButton` —
which gains `size="compact"` so a row action stays this component. Each person in the group panel is
one row stating a net position and naming its direction.

### 5. A time zone was asked for, and a currency was asked for in the wrong place

Both sat behind one 「已自动设置」 disclosure on the Trips form, between a name and
some dates.

A time zone never needed asking: every destination carries one from the geocoder,
and the device knows its own. The trip-level value is only the fallback for a plan
that names no destination.

A currency is not a property of a trip at all. `record_expense` validates every
expense against `trips.home_currency` and stores a `base_amount_minor` converted at
the rate of the day; balances, transfers and settlements are all denominated in it.
It is the ledger's base.

And there was a real defect behind that. `update_trip_details` writes
`home_currency` and recomputes nothing. A trip with a dozen CNY expenses could have
its currency switched to JPY from 「编辑行程资料」 — three taps — leaving every stored
base amount converted against CNY while the ledger sums and settles them as JPY.
Silently.

So: the trip form asks for a name, a destination and dates. The zone is derived by
`tripTimeZone()` — the earliest plan with a destination, else what the trip was
created with, else the device — and stated as a fact under the destination field
rather than offered as a control. The base currency moves to the Ledger as its own
setting, and once a single expense exists the panel states the currency and why it
is fixed instead of offering a control that breaks the books.

A destination's own currency stays and keeps its job: linking an expense to a plan
prefills that expense's currency from where it happened.

## Design vs. shipped app

| Design | Shipped | Where |
| --- | --- | --- |
| One plan editor for both screens | ✅ shipped | `itinerary-composer-sheet.tsx`; Today's copy deleted |
| Today's map / transfer / move actions as rows | ✅ shipped | `planActions` in the shared sheet |
| Trips page read-only; every action a panel | ✅ shipped | `trip-form-sheet`, `trip-manage-sheet`, `join-trip-sheet`, `invite-sheet`, `member-access-sheet` |
| One confirmation shape for all four destructive actions | ✅ shipped | `confirm-sheet.tsx` |
| Flow chips become links; code path is the default | ✅ shipped | `auth-screen.tsx` |
| Code step: one primary, the rest links | ✅ shipped | `auth-screen.tsx` |
| Bilingual 404 | 🟡 shipped, reachable only when signed in | `+not-found.tsx`; `SessionRouter` gives every other path to the auth screen |
| Settle tasks as rows with a compact button | ✅ shipped | `settlement-workspace.tsx`, `ActionButton size="compact"` |
| Group settlement: one net figure per person | ✅ shipped | `settlement-workspace.tsx` |
| Ledger's expense composer | ⬜ not in this pass | already a sheet with the right shape; its own slice |
| Trip form asks name, destination, dates only | ✅ shipped | `trip-form-sheet.tsx` |
| Time zone derived, never chosen | ✅ shipped | `tripTimeZone()` in `trip-defaults.ts`, tested |
| Ledger currency lives in the Ledger | ✅ shipped | `base-currency-sheet.tsx` |
| Ledger currency locked once an expense exists | ✅ shipped | `canChangeBaseCurrency()`, tested |

## What could not be verified here

Checked: `npm run lint`, `npm run typecheck`, 117 Jest tests, a web export whose twelve static routes
build, and every reworked surface rendered in Chromium at 375px from a temporary fixture route.

Not checked: this checkout has no Supabase credentials, so nothing was opened against live data.
Before shipping, on a real trip: adding a hotel transfer and moving a plan between trips from Today;
the QR scanner, invite generation and role changes in the Trips panels; the email-code step and
registration setup; marking a transfer sent, undoing it, and paying in a second currency.
