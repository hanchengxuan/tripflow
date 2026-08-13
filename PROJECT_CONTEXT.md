# TripFlow project context

Last verified: 2026-08-13 UTC

This file is the durable, version-controlled source of truth for engineering continuity. It contains only project-safe context. Product detail belongs in `planning.md`; implementation history belongs in Git.

## Locations

- GitHub: `https://github.com/hanchengxuan/tripflow` (private)
- Default branch: `main`
- Local checkout: `/data/openclaw/workspace/tripflow`
- Discord: `#tripflow`, channel ID `1536353393176608799`
- Supabase project: `TripFlow`, region `ap-northeast-2`
- Production web: `https://tripflow-liart.vercel.app`
- Vercel project: `liamhans-projects/tripflow`

## Product direction

TripFlow is a group travel operating system for travelers who split into parallel branches and later reunite. The MVP centers on:

- shared trips, roles, invitations, and executable itineraries;
- dynamic segments/branches with privacy boundaries and reunion;
- Today/Next Step coordination, status, tasks, votes, and material-change acknowledgement;
- voice/text/manual multi-payer, multi-currency expense splitting and settlement;
- cross-region offline travel information and reliable offline synchronization.

See `planning.md` for the complete P0/P1 scope, non-goals, architecture, milestones, risks, and Definition of Done.

## Technical baseline

- Expo SDK 57, React Native, Expo Router, TypeScript, React 19
- Supabase Postgres, Auth, and Row Level Security
- Jest with `jest-expo`, ESLint, TypeScript checks, GitHub Actions CI/CD
- Amounts use integer minor units with deterministic remainder allocation

## Verified completed work

- Milestone 0 application skeleton for Today, Trips/branches, and Ledger
- Trip/Segment/Member/Expense domain models
- Equal and weighted allocation, remainder handling, validation, and minimal-transfer settlement
- Six core ledger tests
- Web static build and GitHub Actions CI
- Initial Supabase schema deployed with 14 public tables, all with RLS enabled
- RLS bootstrap and privilege escalation issues fixed before production data
- Security-definer authorization implementations moved behind the unexposed `private` schema
- Supabase database security advisor reports no RLS/RPC findings; Auth still warns that leaked-password protection must be enabled now that password login is supported
- Supabase JavaScript client installed with AsyncStorage session persistence and lazy environment validation
- Generated TypeScript database types match the deployed schema
- Open registration, password login, and email OTP login use normalized input, six-digit token validation, and a required profile onboarding gate
- First deployable MVP UI connected end to end to live Supabase data
- Session routing separates unauthenticated login/registration, incomplete onboarding, and the authenticated product
- Automatic profile provisioning on Auth user creation
- Atomic trip creation with owner membership, hashed expiring invite codes, and confirmation-gated invite acceptance from QR, HTTPS link, app deep link, or pasted code
- Live trip switching, member list, profile editing, and shared itinerary creation
- Atomic equal-split expense creation, per-currency balances, and settlement suggestions
- Vercel-ready Expo static web configuration
- First production deployment is live on Vercel and passes HTTP/browser smoke tests with no console errors
- Transactional two-user backend smoke test covers trip creation, invite acceptance, and an exact expense split without leaving test data
- Simplified Chinese is now the primary interface and native app locale, including safe Chinese translations for backend errors
- Trip dates, itinerary date/time, home currency, expense currency, timezone, and invite role use controlled selectors instead of free-form entry
- An independent Profile tab lets each signed-in user edit their display name and review account/trip information
- App Store identity is prepared with bundle ID `com.hanchengxuan.tripflow`, an original 1024px RGB icon, and EAS build/submit profiles
- Web and iOS exports, Expo Doctor, lint, TypeScript, and 26 automated tests pass for the current mobile-readiness milestone; web document language/title are Chinese-aware
- In-app account deletion is deployed end to end: auth credentials are removed, the profile is anonymized, memberships are revoked, sole-owned trips are deleted, and shared trips transfer to another member
- Public Chinese privacy and support pages are live at `/privacy` and `/support`, and the login/Profile screens link to them
- A Simplified Chinese App Store metadata and review-notes draft is maintained in `docs/app-store-metadata-zh-CN.md`
- Account-deletion backend behavior passed transactional shared-trip, sole-trip, ownership-transfer, and stale-JWT tests with all fixture data rolled back
- A protected Supabase Edge Function and editable confirmation flow implement Gemini text and voice expense parsing; production currently resolves to `gemini-3.1-flash-lite`, the key stays server-side, recordings are not persisted, and parsed drafts never auto-save
- Itinerary items now support explicit start/end times, whole-field date/time controls, richer travel cards, trip/member summaries, and one-tap Google Maps search links
- The visual foundation now uses a brighter coastal travel palette, softer cards, and clearer information hierarchy
- Simplified Chinese and English can be switched from login or Profile, persist on device, and cover navigation, core forms, validation fallbacks, privacy, and support pages
- Today now prioritizes one “Up next” destination followed by a flat shared timeline, start/end ranges, and quick duration controls
- Authenticated `places-autocomplete` and `route-estimate` Edge Functions keep the Google keys server-side. Selected Google Place IDs persist on itinerary items; each leg can persist Drive, Transit, Walk, or Cycle and show its corresponding distance/duration. Transit additionally shows scheduled boarding/arrival times, lines or vehicles, stops, stop count, ride duration, headsign, transfers, and aggregate walking. Manual place entry remains available, and route calls require trip membership. Production acceptance passed all four modes, persistence, invalid-mode rejection, Places, authorization, and real transit service details on 2026-08-12
- `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json` record the product and current visual system for future design continuity
- Trips now uses a task-based information architecture: the active trip is the workspace anchor, create/join are always-visible top actions, trip switching is a flat list, and invite management lives inside Travellers
- Trip owners can render and share an HTTPS invite QR code; travellers can scan it in-app with on-device QR recognition or open it from a system camera. Only trusted TripFlow links are accepted, and joining still requires explicit confirmation
- Profile now uses an explicit edit state for display name and avatar, with language, trip context, account actions, and destructive actions separated by frequency and risk
- Profile avatars are stored in a dedicated 5 MB image-only Supabase bucket with per-user write policies; account deletion removes the object and clears its database reference
- Ledger now presents one focused expense-entry surface at a time and flat balance/history rows instead of a stack of equal-weight cards
- Ledger settlement is now task-first: each traveler sees explicit “pay whom how much” actions, four personal pending/completed incoming/outgoing totals, per-member group status, and sender-owned sent/undo controls
- Expense receipts can be captured with the camera or selected from the photo library during entry or attached later; files are normalized client-side and stored privately with expense-scoped access policies
- Settlement status is stored independently from immutable expense evidence, recalculates remaining transfer routes after every payment, and is serialized by trip/currency to prevent concurrent overpayment
- The ledger UI now asks for a source currency and explicit source-to-home-currency rate when they differ; settlement tasks can record the actual payment currency and amount while showing the converted bookkeeping amount. Unconverted legacy cross-currency rows remain flagged in the normalized calculation instead of receiving a guessed rate.
- The `multicurrency_base_amounts` migration is applied to the live Supabase project, adding auditable home-currency amounts/rates to expenses, payer/share rows, and settlements plus normalized settlement RPC overloads.
- Ledger expense entry now supports multiple payers, exact/percentage/share allocations, deterministic remainder handling, and idempotent retries. The `custom_expense_splits` migration is applied to the live Supabase project; custom expenses validate membership and source/base totals server-side and persist proportional base-currency allocations.
- Today, Trips, and Ledger use a shared compact section-heading pattern, flatter overview surfaces, shorter utility copy, and progressive payment-currency controls so the next action is visually primary.
- Today itinerary editing now uses a closed-by-default quick-add composer: the timeline stays visible first, editors open a compact Add plan action when needed, and existing item edits reuse the same surface. Summary labels and helper copy were shortened to keep the next action visually primary.
- Ledger expense entry now presents voice capture as a compact microphone control with accessible state labels; recording duration or processing status appears only while active, and the previous long voice guidance copy is removed.
- The shared web shell reserves space for its fixed navigation, removing the previous title overlap at desktop and mobile widths
- Profile avatars now propagate through the shared trip roster and ledger settlement identities, with an initials fallback and dark-mode-aware presentation
- Every trip in My Trips opens a focused management workspace instead of only switching context; owners and editors can edit name, dates, home currency, and timezone
- Trip owners can progressively manage another traveller's owner/editor/viewer role or remove them after their balance is fully settled, while preserving historical ledger evidence; direct membership mutation is revoked in favor of validated RPCs
- Transactional three-account acceptance verifies editor trip editing, owner role management/removal, and self-membership protection without leaving fixture data
- Removed travellers retain a read-only trip-scoped name/avatar snapshot for historical ledger auditability, and expense creation shares a membership lock with removal to prevent concurrent stranded balances
- Lodging is modeled as one multi-day check-in/check-out interval in the trip timezone rather than repeated daily itinerary rows; Today surfaces a compact Stays rail and can atomically add one transfer from the latest valid prior placed item to the saved hotel
- Owners/editors can edit or delete timeline items through validated RPCs; lodging changes remove stale generated transfers. The trip creator can permanently delete a trip through an explicit confirmation flow, while the protected `delete-trip` Edge Function removes database data before best-effort cleanup of private receipt objects.
- CI runs formatting boundaries, lint, TypeScript, Jest, the web export, and an exact reviewed npm-audit GHSA allowlist that hard-fails critical or newly unreviewed high advisories.
- Production CD waits for the exact `main` commit's Vercel Git Integration status, then smoke-tests `/`, `/ledger`, `/explore`, `/privacy`, and `/support` on `https://tripflow-liart.vercel.app`; the 2026-08-13 run passed for deployment `61ZgGMyXP6hzAoJYsmwXWGahZSKp`.

## Applied Supabase migrations

- `initial_schema`
- `harden_rls_helpers`
- `mvp_foundation`
- `fix_invite_crypto_path`
- `account_deletion`
- `profile_avatars`
- `clear_avatar_on_account_deletion`
- `ledger_receipts_and_settlement_tracking`
- `harden_settlement_rpcs`
- `serialize_settlements_and_bind_receipt_uploads`
- `trip_details_and_member_management`
- `guard_member_removal_with_balances`
- `archive_removed_member_identity`
- `lodging_intervals_and_atomic_transfers`
- `harden_stay_transfer_rpc`
- `itinerary_crud_and_trip_deletion`
- `itinerary_place_ids`
- `remove_legacy_itinerary_update`
- `itinerary_route_modes`
- `profile_onboarding`
- `harden_profile_onboarding`
- `multicurrency_base_amounts`
- `custom_expense_splits`

The live migration list was rechecked after applying `custom_expense_splits`; no pending TripFlow migration remains.

Temporary acceptance fixtures are removed after each test; production may contain real user-created rows.

## Active next milestone

1. Resolve the Apple Developer Program enrollment hold; then sign into Expo/EAS, connect the EAS project, add the public Supabase variables, and produce the first iOS TestFlight build.
2. Choose and configure the long-term public support email through `EXPO_PUBLIC_SUPPORT_EMAIL`, then finalize App Privacy disclosures, age rating, and Chinese screenshots.
3. Run TestFlight acceptance on a current iPhone and human acceptance with real owner/editor/viewer accounts, including QR camera scanning, avatar propagation, and trip/member management.
4. Add segment/branch creation and segment-scoped itinerary membership.
5. Expand the validated ledger with exclusions, item-level sub-splits, partial transfers, and richer exchange-rate snapshots.
6. Address performance-advisor warnings before the dataset grows, and enable Supabase leaked-password protection before broader password-login beta distribution.
7. Configure conservative Google Places and Routes quotas/budget alerts, then monitor production usage before increasing limits.
8. Continue the itinerary experience milestone with Place details, participant/status controls, booking essentials, and richer branch interactions.
9. Add reviewable Gemini itinerary import from photos, files, and shared links; imported content must remain a draft until the traveler confirms it.
10. Extend lodging anchors with booking confirmation, room notes, check-in instructions, and checkout-to-next-stop shortcuts.

## Standing decisions and safety boundaries

- First beta targets iOS and Android via Expo development builds.
- Authentication supports registration without an invite, password login, and email-code login. New users verify an email OTP and must set a password and basic profile before entering the product; scanned invite context survives this flow and still requires explicit acceptance. Apple and Google follow later.
- Cross-branch information is private by default with optional trip-level read-only visibility.
- Each trip selects a home currency while preserving original transaction currencies.
- Never place a service-role key, database password, or signing secret in the Expo client or Git.
- Client configuration uses only the project URL and a publishable key in ignored local/deployment environment variables.
- Database migrations are reviewed before deployment and followed by RLS/security advisor checks.
- Production deployment uses the Vercel Git Integration as the single deploy path from `main`; GitHub Actions verifies the provider status after the quality gate and performs public-route smoke tests.

## Continuity workflow

- Start: read this file, `planning.md`, recent Git history, and live migration state.
- Recover: when Discord context is incomplete, read the latest 50 messages and expand to 100 only if needed.
- Work: treat Git, tests, and live database introspection as evidence; do not rely on conversational recollection alone.
- Finish: update this file, commit and push, then refresh the pinned Discord summary.
- Secrets and personal context never enter this file or the channel summary.
