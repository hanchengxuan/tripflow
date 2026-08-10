# TripFlow MVP Planning

## 1. Product definition

TripFlow is a collaborative travel operating system for trips where people may travel together, split into different groups, and reunite later. It combines an executable shared itinerary with fast, context-aware group expense tracking.

The MVP is designed to be usable on the owner's year-end trip across Hong Kong, Japan, and mainland China. The product should reduce the information scattered across chat messages, screenshots, maps, booking apps, and individual phones.

### Core promise

At any moment, TripFlow should answer:

1. Where are we going next?
2. Who is participating in this part of the trip?
3. What needs to be shown, done, or paid?
4. Who paid, who shares the cost, and what is the final balance?

### MVP success criteria

- A new traveler can join a trip from an invite link or QR code in under one minute.
- A 30-day trip can be split into parallel group branches without duplicating the entire trip.
- A traveler can find the next itinerary item and its essential details within two taps.
- A simple expense can be recorded by voice and confirmed in under 10 seconds.
- Every expense retains an auditable record of original currency, payers, participants, and split amounts.
- The group can settle the trip with a minimized set of transfers.
- Essential itinerary data and draft expenses remain accessible during temporary network loss.

## 2. Target users and primary scenario

The initial users are small groups of 2-8 independent travelers taking multi-city or cross-border trips.

Reference scenario:

- Days 1-10: Owner, A, B, and C travel together.
- Days 11-30: Owner and A follow one route; B and C follow another route.
- Groups may optionally reunite later.
- Shared flights, emergency information, and overall trip details remain at the trip level.
- Itinerary items, visibility, tasks, and expenses follow the relevant segment and participants.

## 3. MVP scope

### P0 — required for private beta

#### A. Account, trip, and membership

- Email or social sign-in.
- Create a trip with name, dates, home currency, and default timezone.
- Invite participants through a link or QR code.
- Allow invite acceptance with minimal onboarding.
- Roles: owner, editor, and viewer.
- Member list and basic profile/display-name management.

#### B. Segments, branches, and reunions

- A trip contains chronological segments rather than one flat member list.
- Each segment has dates/times, locations, participants, and visibility.
- Create a new segment by selecting "Split from here."
- Create two or more parallel branches with different participants.
- Rejoin branches into a later shared segment.
- Move an itinerary item between segments without recreating it.
- Allow trip-level items that remain visible to everyone.
- Default permissions follow segment membership; optional read-only cross-branch visibility is explicit.

#### C. Shared itinerary and "Next step"

- Day and timeline views.
- Create/edit itinerary items: transport, lodging, food, activity, note, and task.
- Store time, location, participants, owner/responsible person, confirmation number, notes, and attachment/link.
- A focused "Next step" card showing destination, departure time, participants, required item, and status confirmations.
- A team dashboard showing the next destination, meeting time, travel time, responsible person, required booking/document, and confirmed-member count.
- Participant confirmation: going, arrived, delayed, or not participating.
- Shared checklists and tasks with an assignee, due time, and completion state.
- Lightweight polls for candidate restaurants/activities with eligible voters, a deadline, and a visible final selection.
- Mark material itinerary changes and require affected participants to acknowledge them; routine edits remain non-blocking.
- Realtime synchronization and a concise activity history for important changes.
- Deep-link out to the device's installed navigation app; full in-app navigation is not part of MVP.

#### D. Fast expense capture

- Persistent quick-add action available from itinerary and ledger screens.
- Manual flow: amount first, then payer; default participants from the active segment.
- Natural-language text input that converts a statement into a structured draft.
- Push-to-talk voice input that transcribes and converts speech into the same structured draft.
- Editable confirmation card showing:
  - total and currency;
  - one or multiple payers and amounts paid;
  - participants included/excluded;
  - split rule and each person's share;
  - category, merchant, time, segment, and optional note.
- High-confidence simple entries may be saved immediately with a five-second undo; ambiguous entries require confirmation.
- Support follow-up corrections to the current draft, such as "B did not participate" or "add 10% service charge."
- Quick actions: "I paid," "Someone else paid," "Unequal split," and "Personal expense."

#### E. Splitting, multicurrency, and settlement

- Split equally, by exact amount, by percentage, or by shares/weights.
- Exclude selected members and support personal/non-reimbursable purchases.
- Support multiple payers and item-level sub-splits within one expense.
- Store original transaction currency and original amount as immutable source values.
- Display estimated value in the trip's home currency.
- Store the exchange-rate source, timestamp, and applied rate; allow an authorized user to override it.
- Calculate pairwise balances and minimize the number of settlement transfers.
- Record full or partial settlements without deleting the source expenses.
- Export a human-readable trip ledger as CSV after the private beta.

#### F. Reliability and safety

- Cache upcoming itinerary items, essential booking details, and recent balances locally.
- Allow offline creation of expense drafts and synchronize them when connectivity returns.
- Conflict-safe updates with visible last-edited information.
- Sensitive documents are private by default and shared only with explicitly selected people.
- Location sharing is off by default; realtime location is not required for MVP.
- Row-level authorization must be enforced by the backend, not only hidden in the UI.
- Basic data export and account/trip deletion flows.

### P1 — add after the core flow is stable

- Receipt and payment-screenshot OCR.
- AI-assisted recommendation synthesis from poll results, location, opening hours, budget, and travel time.
- AI-assisted day planning and disruption-based replanning.
- Push notifications for departure reminders and material itinerary changes.
- Richer expense analytics and category budgets.
- Calendar import/export.
- Better attachment organization and booking-email parsing.

### Explicitly out of MVP

- A general-purpose group chat; TripFlow links back to existing chat apps instead.
- Full turn-by-turn navigation or a proprietary map stack.
- Booking flights, hotels, restaurants, or tickets inside the app.
- Continuous background location tracking.
- Automated bank, card, Alipay, WeChat Pay, Suica, or Octopus account integrations.
- Camera translation, menu translation, and broad travel-guide content.
- Public social feeds or itinerary marketplaces.
- Fully autonomous changes to confirmed itinerary or financial records.

## 4. Key product flows

### Flow 1: Create and share a trip

1. Owner creates the trip and selects dates/home currency.
2. Owner adds an initial shared segment.
3. The app generates an invite link and QR code.
4. Travelers join, set a display name, and enter the shared timeline.

### Flow 2: Split a group

1. From a date or itinerary item, an editor taps "Split from here."
2. The editor creates and names each branch, chooses participants, dates, and visibility.
3. Shared future items are assigned to a branch, kept at trip level, or left for later triage.
4. Each participant's default view follows their active branch.
5. A later "Reunite groups" action creates a shared segment with selected members.

### Flow 3: Coordinate the group's day

1. Each traveler opens the team dashboard and sees the current branch's next destination, meeting time, travel time, responsible person, and required booking/document.
2. Members confirm "going" or use a one-tap state such as "arrived," "delayed," or "not participating."
3. Assigned tasks and checklists show who is responsible and what remains incomplete.
4. A member creates a lightweight poll for undecided places; eligible participants vote before the deadline and an editor records the final selection.
5. Material itinerary changes notify affected participants and remain visibly unacknowledged until each person confirms; routine edits sync without blocking the group.
6. Cross-branch information remains hidden or read-only according to the segment's explicit visibility setting.

### Flow 4: Record a voice expense

1. Traveler holds the voice button and says what happened.
2. Speech is transcribed.
3. The parser resolves people using active-segment context and returns structured expense data.
4. The client performs deterministic validation and split calculations.
5. The traveler reviews the confirmation card or accepts a high-confidence quick save.
6. The expense is stored with transcript, parser result, any manual corrections, and final ledger entries.

Example:

> Dinner was HKD 860. A paid. Me, A, and B split equally; C did not eat.

Expected result:

- A paid HKD 860.
- Owner, A, and B owe HKD 286.67, HKD 286.67, and HKD 286.66 according to the selected rounding policy.
- C owes HKD 0.
- Any rounding remainder is explicit and deterministic.

### Flow 5: Settle balances

1. The ledger shows each person's paid, owed, and net position in original and home currency views.
2. The settlement engine proposes a minimized set of transfers.
3. A participant records a full or partial payment.
4. Both parties can see the settlement status and underlying expenses.

## 5. UX and calculation rules

- Amount-first entry is the default manual interaction.
- The active segment supplies default participants, currency, location context, and timezone.
- AI may extract intent, but final financial arithmetic is performed by deterministic application code.
- The sum of payer amounts must equal the expense total.
- The sum of participant shares must equal the expense total in the original currency's minor units.
- Rounding uses integer minor units and an explicit policy; floating-point arithmetic must not be used for ledger values.
- A saved expense is corrected through an edit history or reversal, not silently rewritten without attribution.
- Voice transcripts are visible before confirmation when recognition confidence is low.
- Names and pronouns are resolved against trip members; unresolved references block saving and request a specific correction.
- The same expense may include multiple allocation groups, such as drinks shared by two people and food shared by four.

## 6. Proposed technical architecture

### Client

- Expo + React Native + TypeScript.
- Expo Router for navigation.
- Local persistent store for cached itinerary data and offline expense drafts.
- A domain layer shared between screens for money, split, balance, and settlement calculations.

### Backend

- Supabase Postgres for relational trip and ledger data.
- Supabase Auth for identity and invite acceptance.
- Supabase Storage for booking documents and later receipt images.
- Realtime subscriptions for itinerary and ledger updates.
- Row Level Security policies based on trip membership, segment membership, and role.
- Server/edge functions for invite handling, speech/LLM orchestration, exchange-rate snapshots, and notifications.

### AI and speech boundary

- Speech-to-text and language-model providers sit behind internal interfaces so providers can be changed.
- The model returns a versioned structured schema; it never writes directly to ledger tables.
- A deterministic validator resolves totals, minor units, split constraints, and rounding.
- Store parser confidence and field-level uncertainties so the UI can require confirmation.
- Initial languages: Mandarin Chinese and English. Cantonese and Japanese recognition should be tested during beta and can be enabled when quality is acceptable.

### Core data entities

- `users`
- `trips`
- `trip_members`
- `segments`
- `segment_members`
- `itinerary_items`
- `item_participants`
- `attachments`
- `expenses`
- `expense_payers`
- `expense_allocation_groups`
- `expense_shares`
- `exchange_rate_snapshots`
- `settlements`
- `activity_events`
- `offline_mutations`

## 7. Delivery plan

### Milestone 0 — product and engineering foundation (Week 1)

- Approve this scope and define the primary test itinerary.
- Create wireframes for trip setup, timeline, branch editor, expense draft, ledger, and settlement.
- Set up Expo, TypeScript, linting, formatting, tests, and CI.
- Establish environments, secrets handling, error reporting, and database migration workflow.
- Define money/split invariants and the versioned voice-expense schema.

Exit: the app boots on iOS/Android, CI passes, and data/permission design is reviewable.

### Milestone 1 — shared trip foundation (Weeks 2-3)

- Authentication, profiles, trip creation, and invitations.
- Trip roles and baseline RLS policies.
- Shared itinerary CRUD, timeline/day views, and attachments/links.
- Realtime updates and activity events.

Exit: four test users can join and collaboratively edit one shared itinerary.

### Milestone 2 — segments and branching (Weeks 4-5)

- Segment model, segment membership, and trip-level items.
- Split-from-here flow, parallel branch views, and reunions.
- Permission and visibility tests across branches.
- Context-aware "Next step" card.

Exit: the 30-day reference scenario works without duplicated trips or leaked private branch data.

### Milestone 3 — ledger and settlement (Weeks 6-7)

- Amount-first expense entry.
- Payers, allocation groups, split modes, rounding, edits, and audit history.
- Multiple currencies and exchange-rate snapshots.
- Balances, minimized settlement suggestions, and partial settlement records.
- Property-based tests for calculation invariants.

Exit: a realistic multi-currency fixture reconciles exactly to zero across all participants.

### Milestone 4 — voice and offline capture (Weeks 8-9)

- Push-to-talk capture and transcription.
- Structured expense parser and field-level confidence.
- Editable confirmation card, follow-up corrections, quick save, and undo.
- Offline expense drafts, retry queue, and conflict handling.

Exit: target simple voice entries are confirmed in under 10 seconds and ambiguous inputs cannot silently corrupt balances.

### Milestone 5 — private beta hardening (Week 10)

- Test on the owner's Hong Kong/Japan/mainland China itinerary.
- Accessibility, timezone, locale, and currency review.
- Security/RLS audit, backup/export/deletion checks, and performance fixes.
- App-store/internal-distribution preparation and beta feedback loop.

Exit: the group can rely on the app for a multi-day pilot before the year-end trip.

## 8. Initial backlog

1. Bootstrap Expo/TypeScript app and CI.
2. Define database schema and migration conventions.
3. Implement money as integer minor units plus ISO currency code.
4. Implement and test split/rounding functions independent of UI.
5. Add authentication and user profiles.
6. Add trips, roles, invitations, and RLS.
7. Add segments, members, branches, and reunions.
8. Add itinerary item CRUD and "Next step."
9. Add expense draft and manual confirmation card.
10. Add ledger balances and settlement minimization.
11. Add voice transcription and structured parsing.
12. Add offline cache/mutation queue.
13. Run cross-account authorization and financial-invariant test suites.
14. Conduct a scripted private-beta trip simulation.

## 9. Risks and mitigations

- **Voice ambiguity:** require structured confirmation for uncertain fields and keep editing fast.
- **Financial correctness:** use integer minor units, deterministic calculations, invariants, and extensive automated tests.
- **Permission leakage across branches:** enforce backend RLS and test with separate user accounts.
- **Offline conflicts:** use stable client-generated IDs, idempotent mutations, version fields, and an explicit conflict UI.
- **Scope pressure:** protect the P0 flows; defer booking, chat, navigation, OCR, and broad AI travel content.
- **Cross-region services:** abstract speech, AI, maps, and exchange-rate providers and test availability before travel.
- **Long-trip complexity:** use segments and filters so users see their active branch by default while preserving a master overview.

## 10. Decisions still to make

- Product name and visual identity.
- Whether the first beta uses passwordless email, Apple/Google sign-in, or both.
- Default cross-branch visibility: private or read-only to all trip members.
- Home currency and exchange-rate source/override policy.
- Rounding remainder policy for equal splits.
- Voice provider availability and data-retention settings in all target regions.
- Distribution approach for the first beta: Expo development build, TestFlight, and/or Google Play internal testing.

## 11. Definition of done for MVP

The MVP is done when four real accounts can create and join a trip, build the reference 30-day branched itinerary, see only authorized segment data, record and correct manual/voice expenses in three currencies, reconcile balances exactly, record settlements, and continue viewing essential itinerary data and drafting expenses during a temporary loss of connectivity.
