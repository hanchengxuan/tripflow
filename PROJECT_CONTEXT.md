# TripFlow project context

Last verified: 2026-08-11 UTC

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
- Jest with `jest-expo`, ESLint, TypeScript checks, GitHub Actions
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
- Supabase security advisor reports zero findings after deployment
- Supabase JavaScript client installed with AsyncStorage session persistence and lazy environment validation
- Generated TypeScript database types match the deployed schema
- Email OTP send/verify service implemented with normalized input and six-digit token validation
- First deployable MVP UI connected end to end to live Supabase data
- Passwordless session gate with secure-link and six-digit OTP handling
- Automatic profile provisioning on Auth user creation
- Atomic trip creation with owner membership, hashed expiring invite codes, and invite acceptance
- Live trip switching, member list, profile editing, and shared itinerary creation
- Atomic equal-split expense creation, per-currency balances, and settlement suggestions
- Vercel-ready Expo static web configuration
- First production deployment is live on Vercel and passes HTTP/browser smoke tests with no console errors
- Transactional two-user backend smoke test covers trip creation, invite acceptance, and an exact expense split without leaving test data
- Simplified Chinese is now the primary interface and native app locale, including safe Chinese translations for backend errors
- Trip dates, itinerary date/time, home currency, expense currency, timezone, and invite role use controlled selectors instead of free-form entry
- An independent Profile tab lets each signed-in user edit their display name and review account/trip information
- App Store identity is prepared with bundle ID `com.hanchengxuan.tripflow`, an original 1024px RGB icon, and EAS build/submit profiles
- Web and iOS exports, Expo Doctor, lint, TypeScript, and 16 automated tests pass for the current mobile-readiness milestone; web document language/title are Chinese-aware
- In-app account deletion is deployed end to end: auth credentials are removed, the profile is anonymized, memberships are revoked, sole-owned trips are deleted, and shared trips transfer to another member
- Public Chinese privacy and support pages are live at `/privacy` and `/support`, and the login/Profile screens link to them
- A Simplified Chinese App Store metadata and review-notes draft is maintained in `docs/app-store-metadata-zh-CN.md`
- Account-deletion backend behavior passed transactional shared-trip, sole-trip, ownership-transfer, and stale-JWT tests with all fixture data rolled back
- A protected Supabase Edge Function and editable confirmation flow implement Gemini 2.5 Flash natural-language expense parsing; the key stays server-side and parsed drafts never auto-save
- Itinerary items now support explicit start/end times, whole-field date/time controls, richer travel cards, trip/member summaries, and one-tap Google Maps search links
- The visual foundation now uses a brighter coastal travel palette, softer cards, and clearer information hierarchy

## Applied Supabase migrations

- `initial_schema`
- `harden_rls_helpers`
- `mvp_foundation`
- `fix_invite_crypto_path`
- `account_deletion`

The database currently contains no application rows.

## Active next milestone

1. Resolve the Apple Developer Program enrollment hold; then sign into Expo/EAS, connect the EAS project, add the public Supabase variables, and produce the first iOS TestFlight build.
2. Choose and configure the long-term public support email through `EXPO_PUBLIC_SUPPORT_EMAIL`, then finalize App Privacy disclosures, age rating, and Chinese screenshots.
3. Run TestFlight acceptance on a current iPhone and human acceptance with real owner/editor/viewer accounts.
4. Add segment/branch creation and segment-scoped itinerary membership.
5. Add deferred financial aggregate validation before expanding beyond equal-split expenses.
6. Address performance-advisor warnings before the dataset grows. The current security advisor has one password-protection warning that is not exercised by the passwordless-only login flow; revisit it before enabling passwords.
7. Replace the currently invalid `GEMINI_API_KEY` in Supabase Secrets and rerun the authenticated production parser smoke test.
8. Continue the itinerary experience milestone: full Chinese/English switching, Places autocomplete (requires a separately restricted Google Maps Platform key and billing), and richer next-step/branch interactions.

## Standing decisions and safety boundaries

- First beta targets iOS and Android via Expo development builds.
- Development login starts with email OTP; Apple and Google follow later.
- Cross-branch information is private by default with optional trip-level read-only visibility.
- Each trip selects a home currency while preserving original transaction currencies.
- Never place a service-role key, database password, or signing secret in the Expo client or Git.
- Client configuration uses only the project URL and a publishable key in ignored local/deployment environment variables.
- Database migrations are reviewed before deployment and followed by RLS/security advisor checks.

## Continuity workflow

- Start: read this file, `planning.md`, recent Git history, and live migration state.
- Recover: when Discord context is incomplete, read the latest 50 messages and expand to 100 only if needed.
- Work: treat Git, tests, and live database introspection as evidence; do not rely on conversational recollection alone.
- Finish: update this file, commit and push, then refresh the pinned Discord summary.
- Secrets and personal context never enter this file or the channel summary.
