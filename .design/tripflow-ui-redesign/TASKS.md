# TripFlow UI redesign tasks

## Shared shell and auth

- [x] Keep the authenticated shell behind one initial recovery state.
- [x] Make Screen headers compact and combine subtitle/meta into one context row.
- [x] Remove redundant InfoCard eyebrow copy while preserving accessibility context.
- [x] Recompose login into a focused mobile-first form with a calm desktop split layout.
- [x] Keep web navigation compact, bottom-floating, and translucent so content remains the visual focus.
- [ ] Add a reusable compact status/toast region for local success and error feedback.

## Today

- [x] Keep add-plan reachable from a persistent action and scroll to the composer anchor.
- [x] Confirm trip-date extension before adding an out-of-range plan.
- [x] Reduce route/location helper copy and make the next-step action hierarchy clearer.
- [x] Replace space-heavy duration/template chips with compact type selection and explicit start/end date-time fields.
- [x] Show route mode controls for any consecutive located items and provide a Google Maps directions hand-off.
- [ ] Verify timeline, stays, and transport at 375px/768px/1280px in light and dark themes.

## Ledger

- [x] Keep add-expense reachable from a persistent action and stack narrow controls.
- [x] Make the settlement task the dominant first action and move completed/group history behind progressive disclosure.
- [x] Shorten AI/receipt guidance without removing confirmation or recovery paths.

## Trips and Profile

- [x] Stack narrow management/editor controls before they collide.
- [x] Make active-trip switching and member actions more visibly task-oriented.
- [x] Group account settings by frequency and isolate destructive actions.

## Verification

- [ ] Run local visual checks at 375px, 768px, and 1280px plus dark mode.
- [ ] Run lint, typecheck, tests, web export, CI, merge, and production smoke tests for each slice.
