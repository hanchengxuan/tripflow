# TripFlow UI 2.2 — "Places, People, and the Point of No Return"

An extension of [`../tripflow-ui-2.0/`](../tripflow-ui-2.0/README.md) and
[`../tripflow-ui-2.1/`](../tripflow-ui-2.1/README.md), not a replacement. Every token, component and
rule still comes from 2.0. This bundle covers the three things neither earlier bundle wrote down:

| Surface | Code |
| --- | --- |
| Map | `src/app/atlas.tsx`, `src/components/destination-atlas.tsx` |
| Me | `src/app/profile.tsx` |
| Plan editor | `src/components/itinerary-composer-sheet.tsx` |
| Branch creation | `src/components/split-segment-sheet.tsx` |

The Map screen shipped after UI 2.0 and has never had a design page at all. The other three share one
gap: the system has a rule for cards, for the rail, and for notices, but never said **what a settings
row looks like**, **what a trailing element means**, or **how an irreversible action asks**. Each
surface answered on its own, and they disagree.

Each is drawn as shipped and as proposed, so a claim about the change can be checked rather than
believed.

## What is here

```
_tokens.css      values lifted one-for-one from src/constants/theme.ts and the shipped components
parts/*.html     the artboard bodies, edited by hand
canvas.json      artboard positions, pages, and the briefs
build.mjs        wraps each part in the Design Component shell, and lays them all out in preview.html
measure.mjs      reads the figures quoted below off the built artboards with Chromium
*.dc.html        built artboards
preview.html     every artboard on one page — this is what gets published
```

Rebuild and re-measure after editing anything in `parts/` or `_tokens.css`:

```bash
node .design/tripflow-ui-2.2/build.mjs
node .design/tripflow-ui-2.2/measure.mjs   # needs the pre-installed Chromium
```

Published canvas: <https://claude.ai/code/artifact/9a0183e5-5193-4f43-a05c-9f8e97b1d1d9>

## Apps this borrows from

Nothing here is invented where a mature product already solved it.

| Pattern | Where it comes from |
| --- | --- |
| The map is the canvas; place detail floats over it | Apple Maps' lowest sheet detent — a rounded card with a visible gap above the screen edge |
| A one-row **compact** place card that opens a **full** one | Google's Places UI Kit names exactly these two layouts |
| One row idiom, grouped surfaces, trailing value or chevron | iOS Settings |
| Trailing area of a list row is "a value, an icon, or a control" | Material 3 `ListItem` |
| Destructive action prominent, Cancel separate and last, confirm panel does not scroll | Apple's action-sheet guidance |
| Selecting people = one surface, hairline rows, a trailing check | Material 3 list selection; the iOS people picker |

## The four findings

Each is a violation of a rule UI 2.0 already wrote down, or a defect a reader can reproduce.

### 1. Map — a map card inside a scrolling page

The screen title says 地图; the section heading below it says 目的地地图 again and adds
「点一下标记，查看这个地点的安排」 — the instructional prose UI 2.1 removed from the Plans screen for
the same reason. The map itself is locked to the world SVG's 1010:666 ratio inside a `ScrollView`, so
on a 390-wide frame it is **350×231 — 27% of the screen**, with the rest given to a bordered card and
a copyright line.

Also on that surface:

- The zoom controls carry a 1px border **and** an ambient shadow. `foundations.html` says a surface
  never combines the two.
- The detail card is bordered, and its city name is a hardcoded `fontSize: 26` — off the ramp.
- The status pill is `accentSoft`/`accent`. Accent marks the one primary path per screen; a status
  badge is not it.
- Marker colour is the only carrier of status. There is no legend; the words exist only in the
  `accessibilityLabel`.
- Every plan row is pressable **and** carries a 「查看」 link. Two affordances, one action.
- Only four plans render, then a dead sentence: 「还有 5 项安排」. Those five have no entry point.
- Pressing a marker means *select* or *navigate away* depending on how many plans it holds.

**Proposed.** The screen stops scrolling: header, legend, then the map takes every remaining pixel.
The place detail splits into Google's two layouts — a one-row compact card pinned to the map's lower
edge (city · status · plan count · timezone and currency), which opens the full place panel in the
same `BottomSheet` the composers already use. The legend names each status beside its colour. The
controls become one tonal surface with one shadow, hairline-separated. Rows keep one affordance and a
chevron. 「还有 5 项安排」 becomes 「在行程里看全部 9 项」 — a row that goes somewhere.

Measured on a 390×844 artboard: the visible map goes from **231px to 567px**, 27% → 67% of the frame.

### 2. Me — four ways to write a row, on one screen

`profile.tsx` uses four row idioms in a single scroll: a 48pt label-and-value row, a 52pt row whose
affordance is the *word* 管理 or 查看, a 56pt two-line disclosure row with a chevron, and an
unfixed-height row holding chips. Measured on the artboards, the settings rows come in **four distinct
heights (36, 48, 52, 56)**. The trailing element is sometimes a value, sometimes a word, sometimes a
chevron, and on 退出登录 nothing at all — so no row lets a reader predict what pressing it does.

Two more, both token-level:

- Dividers are drawn in `backgroundSelected` — the mint **selected-surface** token — where `border` is
  the token for a line.
- Trips and Ledger put this kind of row on a white `ListSurface`. Me lays them straight on the canvas.

And the header's context row is 「资料 · 偏好 · 安全」: a table of contents, not context.

**Proposed.** One row on `ListSurface`, grouped under uppercase group labels, with a rule that can be
stated in one line: **the trailing element says what pressing the row does — a chevron opens a panel;
a value or a control does not.** The password form and the identity-linking form leave the page and
become bottom sheets, so nothing expands and shoves the rest of the screen down; the three stacked
filled secondary buttons under 登录方式 become rows inside that sheet. 退出登录 and 删除账号 each get
their own surface, the way iOS Settings separates them from the rows you read. Context becomes
「东京 3 月 · 管理员」.

Measured: settings-row heights **4 → 1** (56pt), plus the 80pt identity row, which is the same idiom
with a larger leading element.

### 3. Plan editor — the footer changes identity, and the fifth button

「从这里分开走」 and 「删除这项安排」 are two centred text links in a form where every other control is
left-aligned and full width.

Pressing 删除这项安排 renders a confirmation block **in place of** the primary action: while it is
open, the title, times and location already edited above cannot be saved. Its delete button is a
hand-rolled `Pressable` at `minHeight: 48, borderRadius: 12` — a fifth button implementation, beside
an `ActionButton` that already has `tone="danger"`. Cancel and delete then stand side by side at equal
width, where Apple's guidance separates them and puts Cancel last.

**Proposed.** The two per-plan actions become rows — the same vocabulary as Me, left-aligned, each
with the chevron that says it opens a panel, the destructive one in `danger`. **保存 never leaves.**
Confirming happens in its own sheet: the consequence once, including the plan's time and place;
`ActionButton tone="danger"` prominent; 取消 below it, separated by a hairline.

### 4. Branch creation — five accent objects and no count

`split-segment-sheet.tsx` draws each traveller as a 56pt bordered card. The four selected are stroked
in `accent` — the colour reserved for the single primary path — while the primary button 创建分支 sits
below in the same colour. `foundations.html` also says grouping comes from spacing and tonal surfaces
first, and that a surface does not combine a border with another layer. The trailing 同行 / 不去
repeats what the stroke already claims, without offering a control, and how many people are going can
only be counted by eye.

**Proposed.** One tonal surface, hairline-separated rows, a trailing check circle. The count is
stated: 「4 / 5 人」. A traveller who is not going has a dimmed name with 不去 written after it, so the
state still is not carried by colour alone. The leading paragraph becomes an `InlineNotice` — the
shape the system already uses to state a consequence — and names when the branch actually starts. The
From/To fields sit on one row, as in the plan editor.

Measured on a 390×720 artboard: accent-stroked surfaces **4 → 0**, `accentSoft` fill in the traveller
block **82,496px² → 4,096px²** (the check circles), and 创建分支 moves from **128px below the fold to
23px**.

## Design vs. shipped app

Kept current. Update a row when you close a gap.

| Design | Shipped | Where |
| --- | --- | --- |
| Map takes the frame; the screen stops scrolling | ✅ shipped | `Screen`'s new `fill` prop, `src/app/atlas.tsx` |
| Opening view frames the trip, not the world | ✅ shipped | `src/lib/map-framing.ts`, tested |
| Legend naming each status beside its colour | ✅ shipped | `src/components/destination-atlas.tsx` |
| Compact place card → full place panel | ✅ shipped | place-card carousel + `src/components/destination-place-sheet.tsx` |
| Zoom controls: one tonal surface, one shadow, no border | ✅ shipped | `destination-atlas.tsx` `mapControls` |
| One affordance per plan row, `查看` link gone | ✅ shipped | `destination-place-sheet.tsx` via `ListRow` |
| 「还有 N 项安排」 becomes a row that goes somewhere | ✅ shipped | `?place=` on `src/app/itinerary.tsx` |
| A pin press only ever selects | ✅ shipped | `destination-atlas.tsx` |
| One settings-row idiom; trailing element says what a press does | ✅ shipped | `src/components/settings-list.tsx`, `src/app/profile.tsx` |
| Profile / sign-in / password / delete move into sheets | ✅ shipped | `profile-edit-sheet.tsx`, `sign-in-methods-sheet.tsx`, `password-sheet.tsx` |
| Hairlines use `border`, not `backgroundSelected` | ✅ shipped | `settings-list.tsx` |
| Per-plan actions as rows, not centred links | ✅ shipped | `itinerary-composer-sheet.tsx` |
| 保存 never leaves the plan editor | 🟡 implemented as a panel the editor switches into | Confirming takes over the sheet; 返回 restores the form with every field intact. The design draws it as a second panel over the editor — a modal inside a modal, which React Native does not present reliably on iOS |
| Destructive prominent, Cancel last and separated | ✅ shipped | `itinerary-composer-sheet.tsx`, `src/app/profile.tsx` |
| Delete uses `ActionButton tone="danger"`, not a fifth button | ✅ shipped | `itinerary-composer-sheet.tsx` |
| Travellers on one surface with a trailing check, count stated | ✅ shipped | `src/components/split-segment-sheet.tsx` |
| Branch window stated as a localized moment, not raw ISO | ✅ shipped | `split-segment-sheet.tsx`; the trip-extension notice too |

Two things the browser pass forced that the artboards had not anticipated, and which are now in
both: a pin is chrome, so it counter-scales and keeps its size at every zoom; and cities inside one
country land within a few pixels of each other on a world outline, so the place cards page
horizontally and stay in step with the selection rather than leaving overlapped pins as the only way
to reach a place.

## Deliberately not changed

- **A plan's kind cannot be corrected while editing.** The kind chips render only when adding, so
  fixing a plan filed as 活动 instead of 交通 means deleting and re-adding it. That is a data-shape
  question (`onSave` carries no kind, and lodging derives its own times), not a layout one, and it is
  out of scope for this bundle. It is a real gap; it needs its own slice.
- **The map's own projection and gestures.** Pan, pinch and the world outline are unchanged.
- **The account-deletion order.** `profile.tsx` already puts the destructive action above Cancel,
  which is what Apple's guidance asks for. Only its container moves.

## What was checked, and what could not be

Checked: `npm run lint`, `npm run typecheck`, 117 Jest tests (19 of them new, covering
`destinationStatus` and every function in `map-framing`), a web export whose eleven static routes
build, and all four surfaces rendered in Chromium at 375px and 1280px in light and dark from a
temporary fixture route — including pressing through to the delete confirmation. The figures quoted
above come from `measure.mjs` reading the built artboards, not from the running app.

Not checked: this checkout has no Supabase credentials, so none of it was opened against live data.
Before shipping, open a trip and confirm — a map with destinations in two countries frames both and
the polyline is visible between them; pinch and drag stay inside the map's edge and 复位 returns to
the opening frame; the place cards page in step with the pins on a real device; the Me sheets open,
save and dismiss with the keyboard up; deleting a plan from the editor really deletes it and 返回
brings back the typed edits.
