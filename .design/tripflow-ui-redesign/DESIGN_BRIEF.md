# TripFlow UI redesign brief

## Direction

TripFlow keeps the existing **Open Coast Itinerary** visual world: calm coastal surfaces, teal as the single primary action color, journey blue for navigation and information, and sunset coral for planning moments. The redesign is an operational refinement, not a brand replacement.

The interface should feel like a well-marked route at a busy station: the next useful action is visible without instructions, details are grouped by the decision they support, and secondary information recedes until it is needed.

## Problems to solve

- Reload and session recovery currently risk showing a misleading empty product frame before data is ready.
- Header subtitles and helper paragraphs repeat what the controls already communicate.
- Creation and editing actions are distributed across long pages instead of using one predictable contextual entry point.
- Dense rows and equal-weight cards make Today, Trips, Ledger, and Profile harder to scan on a phone.
- Critical changes (trip dates, money, membership) need confirmation at the moment of impact, while routine feedback should be short and local.

## Operating principles

1. One primary action per surface; fixed contextual actions remain reachable without covering content.
2. Show the next decision first, then the minimum metadata needed to act.
3. Prefer native controls and compact labels over explanatory prose.
4. Use tonal grouping and spacing before adding another card or notice.
5. Keep destructive, financial, and date-range changes explicit and reversible until confirmed.
6. Mobile is the source layout; tablet and desktop gain columns only when they improve scanability.

## Acceptance criteria

- A 375px viewport has no horizontal overflow or overlapping navigation/content.
- Every screen title fits in two lines or fewer; its operational context is a compact secondary row.
- Empty, loading, error, and success states each occupy one clear visual region and do not duplicate the page purpose.
- Add/edit flows open from a persistent, accessible action and return the user to the affected content.
- Any operation that changes trip dates, money, membership, or deletes data presents an explicit confirmation before commit.
- The same component expresses the same action/state in light and dark themes, with readable contrast and 44px+ touch targets.
- Chinese and English remain functionally equivalent; shortened copy must preserve the recovery action.

## Scope slices

1. Shared shell and authentication entry: compact screen header, purposeful recovery state, focused login/onboarding layout.
2. Today: next-step rail, timeline, add/edit composer, date-range confirmation, location and route actions.
3. Ledger: add-expense composer, currency/rate entry, settlement task hierarchy, activity details.
4. Trips and Profile: task-first management panels, roster/settings density, destructive and account states.
