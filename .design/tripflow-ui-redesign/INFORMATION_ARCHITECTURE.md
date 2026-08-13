# TripFlow information architecture

## Primary navigation

Four destinations remain stable across native and web builds:

- **Today** — what happens next, today's timeline, and the persistent add-plan action.
- **Trips** — create/join, switch trips, manage the active trip, members, and invites.
- **Ledger** — settle balances first, then inspect activity; persistent add-expense action.
- **Me** — identity, preferences, sign-in methods, support, and account deletion.

Navigation labels are nouns/actions users recognize immediately. Explanatory copy does not replace a visible control.

## Screen anatomy

Every authenticated surface uses this order:

1. Compact title and context row (trip/date/view, not a paragraph).
2. One focused action or next-step surface.
3. Flat supporting sections with explicit section headings.
4. Fixed contextual action when creation is available.

## Core flows

### Add or edit a plan

Today → fixed `+` → composer anchor → choose kind/date/place → save. If dates leave the trip window, show the proposed new range and require `Edit dates` or `Extend and add`.

### Record an expense

Ledger → fixed `+` → manual or AI draft → amount/currency → payer/share → optional receipt → save. Source currency remains visible; a rate is requested only when needed.

### Manage a trip

Trips → active trip → one of Create, Join, Manage. Manage opens a focused workspace with trip details first, roster second, invite last. Destructive actions are isolated behind confirmation.

### Recover a session

Auth/session load → one compact recovery state → authenticated shell only after the initial trip/profile load. Background refresh keeps existing content visible.
