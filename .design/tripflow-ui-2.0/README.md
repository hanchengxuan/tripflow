# TripFlow UI 2.0 — "Rail & Ledger"

A full UI system for TripFlow, derived from what the app actually does rather than from a
generic mobile template. Two structures carry the product:

- **The time rail** — the itinerary is one continuous spine. Times sit in a fixed 46px gutter so
  every title starts on the same axis, and **travel occupies the gap between two plans** instead of
  hiding inside a card.
- **The balance bar** — one bipolar bar replaces four equal-weight metric tiles. Left of the zero
  tick is what you owe, right is what is owed to you.

## What is here

```
src/          editable sources (tokens.css, kit.css, *.html with <link> tags)
build.mjs     inlines the CSS into each page so every file is self-contained
*.html        built, self-contained pages — these are what gets published
```

Rebuild after editing anything in `src/`:

```bash
node .design/tripflow-ui-2.0/build.mjs
```

| Page | Contents |
| --- | --- |
| `foundations.html` | Direction, six rules, semantic colour table, type ramp, spacing/radius/elevation |
| `palette-options.html` | Palette study — three mature directions vs. the original, applied to a real screen. Option C shipped |
| `components.html` | Atoms — actions, selection, input, feedback, navigation |
| `components-patterns.html` | Composed patterns with anatomy + rules — Next up rail, Section heading, Metric, Timeline item, Route segment, Stay card, Settlement task, Expense row, list rows |
| `screens-today.html` | Today · with trip / add-plan sheet / empty state |
| `screens-ledger.html` | Ledger · settle / activity / add-expense sheet |
| `screens-trips-account.html` | Trips · trip management · Me |
| `screens-auth.html` | Auth · sign in / verify code / register profile / invite entry |
| `screens-dark.html` | Today and Ledger in dark |

The pages above are the complete system — every token, component, pattern, and screen lives here.

A partial Figma mirror exists (foundations + 12 components) but stops there: the Figma Starter plan
allows only 20 MCP tool calls per month, which the token and component build consumed. It is a
mirror, not a source — nothing in this bundle depends on it.
<https://www.figma.com/design/6sfc9nypJzKHRHYwqtOjgu>

## Palette: Neutral Ink & Pine

The first pass kept the original coastal teal across surfaces, and it read as a mint wash: a
tinted canvas (`#F4FAFA`), a tinted selected state (`#D9EEEA`), and six itinerary hues all at
similar saturation, so nothing was clearly the primary action.

The shipped palette follows what mature products actually do — a neutral field with colour spent
only on one primary action and on status:

- **Surfaces carry no hue.** Canvas `#F7F8F8`, subtle `#EFF1F1`, hairline `#E2E5E5`.
- **One accent.** Pine `#0E6E57` marks the single primary path per screen and nothing else.
- **Kinds are one muted family** at matched lightness and chroma, so no kind shouts over another.
- **Dark is a near-black with a faint green-grey cast**, not a navy, so pine stays the only real hue.
- **Money keeps its own semantics**: `money/in` green, `money/out` ochre `#A85A22`, red reserved for
  errors and deletion. Where a green primary button sits near a green "to receive" amount, form
  disambiguates before hue does: filled block = action, text = amount.

Two alternatives were built and rejected — Slate & Indigo (cool neutral + indigo) and Warm Sand &
Clay (warm neutral + clay red). Both are preserved in `palette-options.html` alongside the original,
each pinned to its own token block so the comparison stays reproducible.

## Design decisions and why

| Decision | Reason from the code |
| --- | --- |
| Travel moved into the gap between plans | `routeDetails()` currently nests mode chips, an estimate, a transit plan, and a Maps link *inside* every item, so a row can be taller than the screen. |
| Stays stated once as a range | `stayNightsInZone` already models a stay as a span; the rail should not repeat it daily. |
| Bipolar balance bar | `ledger.tsx` shows four equal `Metric`s (to send / sent / to receive / received) with no sense of net position. |
| `money/out` is coral, never red | The code uses `theme.danger` for "to send". Owing money is a direction, not an error. |
| Composers became bottom sheets | Both composers are inline blocks reached by scroll-to-anchor; a sheet removes the scroll choreography in `Screen`'s `scrollToKey`/`scrollToOffset`. |
| Six kind hues, each with a tint | `getKindAccent()` gives lodging `#087F6A` and activity `#0F8A6E` — visually the same colour. Lodging moved to violet. |
| Kind hues muted to one family | The original six sat at mixed saturation and competed with each other and with the primary action. They now share matched lightness and chroma. |
| `kind/activity` lighter than `accent/primary` | Both were green. A rail dot must never read as the primary action. |
| Screen header is title + one context row | `Screen` takes `title` + `subtitle` + `meta`, and callers pass sentences that repeat the controls. |

## Mapping to the codebase

`src/tokens.css` is the source of truth. Names match the Figma variable collections
(`Color` / `Color · Dark`) one-for-one.

To adopt in `src/constants/theme.ts`, the semantic names map directly:

| Token | `Colors.light` / `Colors.dark` key |
| --- | --- |
| `bg/canvas` | `background` |
| `bg/surface`, `bg/raised` | `backgroundElement` |
| `bg/selected` | `backgroundSelected` |
| `text/primary` | `text` |
| `text/secondary` | `textSecondary` |
| `danger/base` | `danger` |

New keys the current theme does not have yet: `bg/subtle`, `text/muted`, `text/link`,
`accent/primary`, `accent/pressed`, `accent/soft`, `accent/info`, `accent/plan`,
`money/in`, `money/out`, `money/settled`, `border/hairline`, `border/field`, `border/focus`,
`kind/*` and `kind-soft/*`, `avatar-fg`. These are currently hardcoded hexes scattered across
`index.tsx`, `ledger.tsx`, and `app-tabs.web.tsx` — the redesign assumes they become theme keys.

## Design vs. shipped app

Kept current. Update a row when you close a gap.

| Design | Shipped | Where |
| --- | --- | --- |
| Neutral Ink & Pine palette | ✅ shipped | `src/constants/theme.ts` |
| Spacing / radius / size scales | ✅ tokens exist | `Spacing`, `Radius`, `Size` in `theme.ts` — new code should use them; existing files still hold literals |
| Time rail, day separator, route in the gap | ✅ shipped | `src/components/timeline-rail.tsx`, `route-plan.tsx`; route spines use the designed 4pt/5pt dashed cadence without adding layout height |
| Bipolar balance bar | ✅ shipped | `src/components/balance-bar.tsx`, `src/lib/balance-bar.ts` |
| Add-plan and add-expense as bottom **sheets** | ❌ still inline blocks reached by scroll anchoring | `src/app/index.tsx`, `src/app/ledger.tsx`, `src/components/screen.tsx` |
| Stay card with kind bar + nights tile | ✅ shipped | `src/components/stay-card.tsx`, `src/app/index.tsx` stays section |
| Notice with a 3px accent bar | ✅ shipped | `src/components/form-controls.tsx` `InlineNotice` |
| Screen header = title + one context row | ✅ shipped | `src/components/screen.tsx` and every `Screen` caller |
| Travel modes compact until expanded | ✅ shipped | `RouteEstimateChip` toggles `src/app/index.tsx` `routeModeControls` |

The travel-mode product decision preserves explicit control without keeping four controls open: the current mode and estimate always remain visible, and pressing that chip reveals all four modes in place. Selecting one collapses the choices while the estimate refreshes.

### 0. Auth screens — designed, not yet built

`src/features/auth/auth-screen.tsx`. Design: `screens-auth.html`.

The shipped login screen was redesigned after review. What changes:

- **Google gets its official four-colour G mark** on a white ground with a hairline border, per Google's own guidance. The shipped button is an unmarked secondary block.
- **One headline, one subline.** The screen carried two sublines saying the same thing, plus a decorative orange rule the system's own rules forbid.
- **The lone `邮箱` chip goes.** With phone sign-in disabled it is a chooser with one option.
- **Flow selection stops being upfront.** `密码登录 / 注册 / 验证码` were three chips the user had to understand before typing anything; they become bottom text links, with the email-code path as the default.
- **`或用邮箱` divider** separates the provider path from the email path.
- **Registration profile setup gets a design at all** — it previously had none. Three-segment progress, an explicitly optional avatar, name and password.
- **Invite entry names the trip in the headline** rather than burying it in body copy.

## Next slice: pick up here

Remaining gaps in the order they should be done. Each is its own `codex/*` branch and PR.

### 1. Sheet composers — largest, do last

`src/app/index.tsx`, `src/app/ledger.tsx`, `src/components/screen.tsx`. Design: `screens-today.html` and `screens-ledger.html` bottom sheets with a scrim.

Both composers are inline blocks reached by scroll anchoring. `Screen` carries `scrollToKey` / `scrollToOffset` and a two-frame target scroll that exists only to bring those blocks into view; a sheet removes the need for all of it. Highest risk in the set — it touches shared shell behaviour that has already been fixed twice for scroll bugs. Verify on a real device, not only the browser pane.

## Handing this to another agent

Use the `$tripflow-ui` skill (`.agents/skills/tripflow-ui/`). It encodes the non-negotiable rules, token discipline, component boundaries, the verification loop, and the traps already hit.

What still cannot be verified without help:

- **The balance bar's proportional fill.** Needs a trip carrying an unsettled expense; the fill is otherwise only covered by `src/lib/__tests__/balance-bar-test.ts`.
- **The day separator.** Needs a trip with plans on two different dates.
- **A multi-leg transit plan.** Needs a route where the estimate service returns transit steps.
- **Desktop width.** The browser pane's capture did not match the layout box it reported at 1280px, so no desktop claim in this work is trustworthy.

## Known limitation

The Figma file's Light and Dark palettes are two separate single-mode collections rather than two
modes of one collection: the Figma **Starter plan caps a collection at 1 mode** (and at 3 pages,
which is why the file uses sections inside three pages). The token names are identical across both
collections, so on a paid plan this collapses into one two-mode collection without renaming
anything.

## Accessibility notes

- Every text/background pair in `tokens.css` clears WCAG AA at its intended size; the two failures
  found during the build (`kind/food`, `kind/task`) were fixed at the token level, not per-component.
- Colour never carries state alone — every money figure has a caption naming its direction, and
  every kind pill carries its label.
- Touch targets are 44pt minimum (`--size-touch-min`); controls are 48px (`--size-control`).
- The floating nav sits 16px above the safe area and the FAB 86px up, so neither covers the other.
