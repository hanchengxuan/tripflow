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

### Consolidated scope at a glance

The following six capability groups are the canonical product scope. The detailed requirements and flows below elaborate these groups; when prioritization is unclear, this section decides whether work belongs in P0, P1, or outside the MVP.

1. **Shared trip foundation (P0)**
   - Create one trip, invite 2-8 travelers, assign owner/editor/viewer roles, and keep a shared master overview.
   - Store itinerary items, booking details, links, documents, tasks, member status, and activity history in one collaborative space.
2. **Dynamic travel groups (P0)**
   - Model a long trip as dated segments whose membership can change.
   - Let travelers split into parallel branches, keep branch-specific visibility and expenses, and reunite later without duplicating the trip.
3. **Daily group execution (P0)**
   - Provide Today, timeline, team-dashboard, and Next-step views.
   - Support participant confirmations, one-tap arrival/delay states, shared tasks, lightweight place/activity polls, and acknowledgement of material changes.
4. **Fast group ledger (P0)**
   - Record expenses manually, through natural-language text, or by push-to-talk voice.
   - Resolve the active segment's members by default; support multiple payers, exclusions, equal/exact/percentage/share splits, sub-splits, personal expenses, and follow-up corrections.
   - Preserve original currencies and exchange-rate snapshots, calculate deterministic balances, and minimize final settlement transfers.
5. **Cross-region and offline operation (P0)**
   - Provide Hong Kong, Japan, and mainland China readiness cards for payment, transit, connectivity, emergencies, and essential etiquette.
   - Generate a privacy-aware offline pack containing the traveler's relevant itinerary, local-script addresses, booking numbers, selected QR/documents, contacts, and phrases.
   - Keep Next step available and expense drafting functional during temporary network loss.
6. **Trust, privacy, and correctness (P0)**
   - Enforce trip/segment authorization on the backend, keep sensitive documents private by default, and make location sharing opt-in.
   - Use auditable edits, integer minor-unit money arithmetic, explicit rounding, validation, idempotent offline sync, and export/deletion controls.

P1 extends these foundations with receipt/screenshot OCR, AI-assisted recommendations and disruption replanning, camera translation with full-screen show mode, push notifications, analytics/budgets, calendar exchange, and booking-email parsing. P1 features must reuse P0 permissions and confirmation rules and may not silently change confirmed itinerary or ledger data.

The MVP deliberately does not include group chat, in-app booking, proprietary turn-by-turn navigation, continuous background location, direct payment-account integrations, public social/content marketplaces, or autonomous financial/itinerary changes.

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

- Today and timeline views, with the current day presented as an executable sequence rather than a static list.
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

- Cache upcoming itinerary items, essential booking details, travel-readiness content, and recent balances locally.
- Allow offline creation of expense drafts and synchronize them when connectivity returns.
- Conflict-safe updates with visible last-edited information.
- Sensitive documents are private by default and shared only with explicitly selected people.
- Location sharing is off by default; realtime location is not required for MVP.
- Row-level authorization must be enforced by the backend, not only hidden in the UI.
- Basic data export and account/trip deletion flows.

#### G. Cross-region readiness and offline travel pack

- Generate a downloadable offline pack from the trip's actual itinerary and selected shared information.
- Include addresses and hotel names in both the traveler's language and local script, booking/confirmation numbers, saved QR attachments, emergency contacts, and selected phrases.
- Provide concise region cards for Hong Kong, Japan, and mainland China covering the group's chosen payment methods, transit setup, connectivity, emergency basics, and practical etiquette reminders.
- Automatically surface the relevant region card from the active segment while allowing travelers to switch regions manually.
- Keep the "Today" and "Next step" cards usable offline, including the local-language address and any item/document that must be shown.
- Allow travelers to choose which sensitive documents enter the offline pack; private documents never become group-visible implicitly.

### P1 — add after the core flow is stable

- Receipt and payment-screenshot OCR.
- AI-assisted recommendation synthesis from poll results, location, opening hours, budget, and travel time.
- AI-assisted day planning and disruption-based replanning for weather, closures, delays, missed transport, or traveler fatigue; all changes are shown as a reviewable diff before being applied.
- Camera translation for menus, signs, and essential labels, with side-by-side original/translation and a full-screen "show the other person" mode.
- Push notifications for departure reminders and material itinerary changes.
- Richer expense analytics and category budgets.
- Calendar import/export.
- Better attachment organization and booking-email parsing.

### Current itinerary experience upgrade

- Completed: replace isolated timestamp entry with a clear start/end range, whole-field picker controls, and quick duration choices.
- Completed: prioritize an actionable “Up next” destination and show later plans as a continuous timeline instead of a notebook-like card stack.
- Completed: add persistent Chinese/English switching across navigation, forms, validation fallbacks, privacy, and support pages.
- Completed: Google Places autocomplete routes through an authenticated Supabase Edge proxy, selected Place IDs persist, and consecutive placed stops show a protected Routes API driving estimate.
- Completed foundation: an airy coastal palette, stronger spacing, fewer elevated surfaces, and a durable product/design contract.
- Next: add Place details, participant status, booking/document essentials, and reviewable photo/file/link itinerary import.

### Explicitly out of MVP

- A general-purpose group chat; TripFlow links back to existing chat apps instead.
- Full turn-by-turn navigation or a proprietary map stack.
- Booking flights, hotels, restaurants, or tickets inside the app.
- Continuous background location tracking.
- Automated bank, card, Alipay, WeChat Pay, Suica, or Octopus account integrations.
- Broad editorial city-guide content or a general travel-content marketplace.
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

### Flow 4: Prepare for a region and operate offline

1. Before departure, a traveler downloads an offline pack generated from the trip, their segments, selected shared bookings, and explicitly selected private documents.
2. On entering Hong Kong, Japan, or mainland China, the app surfaces the matching payment, transit, connectivity, emergency, and etiquette card.
3. The traveler opens "Today" or "Next step" without a network connection and can show a driver or staff member the destination in local script plus the relevant QR code or confirmation number.
4. Any offline expense drafts are queued locally and synchronized idempotently when connectivity returns.
5. After MVP, the same moment can invoke camera translation or an AI-proposed itinerary adjustment; neither may silently alter confirmed trip data.

### Flow 5: Record a voice expense

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

### Flow 6: Settle balances

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
- Google Places autocomplete runs only through an authenticated Supabase Edge Function. Its separately restricted API key is stored server-side as `GOOGLE_PLACE_API_KEY`, never in Expo public variables or the client bundle; manual location entry remains available when the provider is unavailable.
- Google Routes requests run through an authenticated, trip-membership-checked Edge Function using the server-side `GOOGLE_ROUTES_API_KEY`. The first beta uses traffic-unaware driving estimates and keeps a session cache to reduce duplicate billable requests.
- Production acceptance on 2026-08-12 verified Places suggestions, persisted Place IDs, Routes distance/duration, membership rejection, Gemini text expense parsing, and Gemini Mandarin voice expense parsing.

### AI and speech boundary

- Speech-to-text and language-model providers sit behind internal interfaces so providers can be changed.
- The model returns a versioned structured schema; it never writes directly to ledger tables.
- A deterministic validator resolves totals, minor units, split constraints, and rounding.
- Store parser confidence and field-level uncertainties so the UI can require confirmation.
- Initial languages: Mandarin Chinese and English. Cantonese and Japanese recognition should be tested during beta and can be enabled when quality is acceptable.
- Expense recordings are processed only to create an editable draft and are not persisted by TripFlow.

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

Current implementation and acceptance requirements:

- A changed profile avatar and display name must propagate to every shared identity surface, including trip rosters and ledger settlement rows; initials remain the accessible fallback.
- Every row in My Trips opens a dedicated view/manage workspace rather than silently switching context.
- Owners and editors can edit the trip name, start/end dates, home currency, and timezone through one focused form; viewers receive the same details read-only.
- Owners can view all travellers, change another member between owner/editor/viewer, and remove a fully settled member with explicit confirmation; removal is blocked while any currency balance remains open.
- A user cannot change or remove their own membership; historical expenses and settlements remain intact when a traveller is removed, while future itinerary/segment participation is revoked.
- A removed traveller's name and avatar are retained as a trip-scoped read-only audit snapshot so historical payer, split, and settlement evidence never degrades to an anonymous label.
- Member removal and expense creation share a transaction lock so an expense cannot add a new balance while that member is being removed.
- Lodging is a date range with separate check-in and check-out date/time, not one repeated item per day; a stay remains visible as shared context across every covered day.
- Saved lodging acts as a route anchor. From the stays overview, editors can atomically add one transfer from the latest valid prior itinerary place to the hotel; the database prevents duplicate transfers across simultaneous editors.
- Hotel entry defaults to familiar 15:00 check-in / 11:00 check-out values but keeps both times editable and bilingual.
- Lodging input and display use the trip timezone, stay within the trip date range, and require a navigable hotel/location before saving.
- Owners/editors can update or delete every itinerary item from the timeline; lodging edits invalidate and remove the old generated hotel transfer, while lodging deletion cascades to it.
- Trip details expose a clear edit action. The original trip creator can permanently delete the whole trip only after an explicit irreversible-action confirmation; private receipt objects are cleaned server-side only after the database deletion succeeds.
- Create trip, join by invite, edit trip, invite traveller, and manage existing traveller remain separate progressive tasks rather than simultaneous stacked forms.

Exit: four test users can join and collaboratively edit one shared itinerary.

### Milestone 2 — segments and branching (Weeks 4-5)

- Segment model, segment membership, and trip-level items.
- Split-from-here flow, parallel branch views, and reunions.
- Permission and visibility tests across branches.
- Context-aware "Next step" card.
- Today view, region-card selection, and offline-pack generation from itinerary data.

Exit: the 30-day reference scenario works without duplicated trips or leaked private branch data.

### Milestone 3 — ledger and settlement (Weeks 6-7)

- Amount-first expense entry.
- Payers, allocation groups, split modes, rounding, edits, and audit history.
- Multiple currencies and exchange-rate snapshots.
- Balances, minimized settlement suggestions, and partial settlement records.
- Property-based tests for calculation invariants.

Current implementation and acceptance requirements:

- Show every outstanding route as an explicit instruction: who must transfer to whom, in which currency, and how much.
- Show each traveler’s pending outgoing, completed outgoing, pending incoming, and received totals, plus a compact group-wide status view.
- Let only the sender mark their own suggested transfer as sent or restore it to unsent; update both parties’ status immediately without changing the source expenses.
- Recalculate pending totals and minimized routes from settlement-adjusted balances after every new expense, payment, or undo.
- Allow an expense receipt to be captured with the device camera or selected from the photo library during entry, and attached later from expense details.
- Keep receipt files private, bind each upload to an authorized expense, provide full receipt viewing, and preserve payer/split evidence alongside it.
- Present the journey as “My settlements → Group settlement → Expense activity,” prioritizing personal actions and progressively disclosing financial evidence instead of stacking equal-weight blocks.

The next expansion is multiple payers, exclusions, unequal shares, partial amounts, exchange-rate snapshots, and property-based reconciliation coverage.

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

- App Store subtitle, screenshots, support contact, and final privacy-policy wording.
- Whether the first beta uses passwordless email, Apple/Google sign-in, or both.
- Default cross-branch visibility: private or read-only to all trip members.
- Home currency and exchange-rate source/override policy.
- Rounding remainder policy for equal splits.
- Voice provider availability and data-retention settings in all target regions.
- Android distribution timing after the first iOS TestFlight beta.

## 11. Definition of done for MVP

The MVP is done when one scripted private-beta journey proves the complete consolidated scope:

1. Four real accounts create and join a 30-day trip through an invite link or QR code.
2. All four travelers share days 1-10, then split into Owner+A and B+C branches for days 11-30, with an optional later reunion.
3. Each traveler sees the correct Today/team-dashboard/Next-step information, authorized branch data, shared tasks, poll outcomes, and material-change acknowledgements.
4. The group records simple and complex expenses through manual, text, and voice entry in HKD, JPY, and CNY, including multiple payers, exclusions, unequal splits, and sub-splits.
5. Every saved expense passes deterministic total/share validation; edits remain auditable and all participant balances reconcile exactly to zero.
6. The app proposes minimized settlement transfers and records full or partial settlements without losing source-expense history.
7. A traveler downloads the correct region/offline pack, accesses essential local-script addresses and selected booking details without connectivity, and creates an offline expense draft that later synchronizes exactly once.
8. Separate-account tests confirm that branch data and sensitive documents are never exposed outside their explicit permissions.
