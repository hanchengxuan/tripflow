# TripFlow project context

Current state only: what is true now, standing decisions, what comes next, and what is blocked. Git history records what each PR did; do not log changes here. Edit this file only when current state, a decision, or a blocker changes. Product scope lives in `planning.md`. Never record credentials, tokens, service-role keys, personal data, or private conversation details.

## Locations

- GitHub: `https://github.com/hanchengxuan/tripflow` (private), default branch `main`
- Maintainer checkout: `/data/openclaw/workspace/tripflow`
- Discord: `#tripflow`, channel ID `1536353393176608799`
- Supabase project: `TripFlow`, region `ap-northeast-2`
- Production web: `https://tripflow.fun` (canonical; `tripflow-liart.vercel.app` also serves the app)
- Vercel project: `liamhans-projects/tripflow`

## Product direction

TripFlow is a group travel operating system for travellers who split into parallel branches and later reunite: shared trips and executable itineraries, branches with privacy boundaries, Today/Next Step coordination, multi-payer multi-currency expense splitting and settlement, and offline travel information. See `planning.md` for scope, non-goals, and the Definition of Done.

Live today: email-OTP/password auth with onboarding; trips, roles, QR/link invites, trip and member management; Today (Up Next countdown, day briefing, time rail, stays, inline health hints, delay shift); Plans and Map tabs; trip branches (split from the plan editor); polls on Trips; booking import (flight/hotel PDF or image); Ledger with multi-payer/custom splits, multi-currency, receipts, receipt-photo and text/voice quick fill, settlement tasks; the 小途/Tabi assistant on every tab; Chinese (primary) and English.

## Technical baseline

- Expo SDK 57, React Native, Expo Router, TypeScript, React 19. Jest (`jest-expo`), ESLint, Playwright.
- Supabase Postgres, Auth, Storage, RLS, and Edge Functions: `ask-trip`, `parse-expense`, `parse-booking`, `places-autocomplete`, `route-estimate`, `delete-trip`, and `suggest-itinerary-edit` (deployed but no longer called by the app).
- Gemini calls share one bounded request: primary `gemini-3.1-flash-lite`, fallbacks `gemini-2.5-flash-lite` then `gemini-2.5-flash`, at most three requests. Invalid-request, credential, and billing errors are not retried; database writes are never retried.
- Google Places and Routes keys stay server-side in the Edge Functions; route estimates need a Google Place ID at both ends.
- Destination search uses the keyless Open-Meteo geocoder (it returns an IANA time zone) plus a hand-kept alias table in `destination-search.ts`.
- Exchange rates come from Frankfurter (reference rates, not intraday), cached per pair for offline use, with manual override; edits keep an expense's recorded rate.
- Design: UI 2.0 "Rail & Ledger" system in `.design/tripflow-ui-2.0/` (editable sources in `src/`; generated pages are untracked; README has the design-vs-shipped table). The `$tripflow-ui` skill holds its rules. A Figma mirror (file key `6sfc9nypJzKHRHYwqtOjgu`) is stale and not a source of truth; the Figma Starter plan allows only 20 MCP calls a month.
- Schema truth is `supabase/migrations/` plus the live migration list; `src/types/database.ts` keeps deliberate explicit nullable RPC-argument corrections when regenerated.

## CI/CD

- `validate` is the stable merge gate over parallel static (format, whitespace on the commit range, lint, TypeScript, npm audit), Jest, Expo Doctor plus web/iOS export, and Playwright public-route smoke at mobile and desktop widths. A PR-size workflow is advisory.
- The npm-audit gate uses an exact reviewed GHSA allowlist and hard-fails on critical or new unreviewed high advisories or an incomplete report.
- Production deploys only through the Vercel Git Integration from `main`. GitHub Actions waits for that commit's Vercel status, then smoke-tests `/`, `/ledger`, `/explore`, `/privacy`, and `/support` on `https://tripflow.fun`.
- Expo SDK patch drift (Doctor recommending newer patches) can fail CI or halt the production run; fix it with a focused dependency-only PR.
- The web export copies Expo's `+not-found.html` to `dist/404.html` so Vercel serves the branded 404.
- Branch protection cannot be enabled on the current private-repo plan (API returns 403); see `AGENTS.md` for the manual merge gate.

## Standing decisions and safety boundaries

Security and data

- Never put a service-role key, database password, or signing secret in the Expo client or Git. The client uses only the project URL and publishable key from ignored env files or deployment variables.
- Migrations are reviewed before deployment and followed by RLS/security-advisor checks. Acceptance fixtures are rolled back; production holds real user rows.
- Membership changes go only through validated RPCs. Removing a traveller requires a settled balance and keeps a read-only name/avatar snapshot (`trip_member_archives`) so ledger history never shows an anonymous label.
- Keep the local security backports (node-forge, braces, sprintf-js) and their regression tests until upstream releases include the fixes; do not add those advisories to the audit allowlist.
- The lockfile must resolve on Linux x64 with CI's npm (optional `@emnapi/*` peers); a macOS-only lockfile breaks CI.

Product rules

- Auth: open registration, password and email-OTP login; new users verify OTP and set a password and profile before entering. Invite context survives onboarding and still needs explicit acceptance. Apple and Google sign-in follow later.
- Invites trust only `tripflow.fun`, `www.tripflow.fun`, and the Vercel alias; scanning never auto-joins.
- Branch data is private by default with optional trip-level read-only visibility. Branches scope people and plans, never money: the ledger stays one ledger per trip.
- Each trip has a home currency; original transaction currencies are preserved. Money uses integer minor units with deterministic remainder allocation.
- Settlement is ledger-wide: nothing auto-settles while any balance is open, and manual settled marks are never changed. Expenses that need no transfer settle automatically through triggers.
- When conversions are incomplete, settle in each original currency; never guess a rate. Prior converted settlements need exchange-rate reconciliation before more payments. `buildSettlementPlan` owns the accounting mode for summary, tasks, and group view.
- Keep home-currency redenomination out of UI-only work until an atomic backend operation and data-safety acceptance exist.
- Lodging is one check-in/check-out interval in the trip time zone, not daily rows.
- AI never writes on its own. Expense drafts, booking previews, and 小途/Tabi proposals (`update_plan`, `add_plan`, `add_expense`; no deletes) are applied only after the traveller confirms through existing save paths. Recordings are not persisted.
- `ask-trip` reads the trip with the traveller's own token (RLS applies) and picks the reply language on the server from the latest message.
- The itinerary health check runs on device with no AI call; any Gemini enrichment must be explicit opt-in.
- The owner removed the single-plan AI edit panel as not useful. Itinerary edits favour buttons (time shifts, one-tap fixes, delay shift); a typed delay could later map onto the delay planner.
- Booking import takes facts only (flights, stays); it infers no transfers, activities, or expenses. Originals stay uploader-private. Existing plans are not backfilled with destinations.
- Travel modes use progressive disclosure: the chosen mode stays visible and expands to the four options on tap.
- UI shows only the active language (no bilingual duplicate labels); icon-only controls keep the text as their accessibility label. Desktop web uses a 200pt sidebar and centred sheets; mobile uses bottom tabs and bottom sheets.
- Use `Spacing`/`Radius`/`Size` tokens and semantic colours from `src/constants/theme.ts`; convert old literals only when touching a file. The only fixed colour literals are the invite QR pair, the camera viewport, and the splash overlay. `moneyOut` is for owed money; `danger` is for destructive actions only.
- Avatars are stored as a 256px square. Supabase image transformations need the Pro plan; the organization appears to be on Free, so revisit only if the plan changes.
- The fictional Loom demo trip in production is kept on purpose for recordings.
- `app.json` sets the `expo-router` `origin` to `https://tripflow.fun`; native config changes need a rebuild to reach devices.

## Active next milestone

1. Resolve the Apple Developer Program enrollment hold; then sign into Expo/EAS, connect the project, add the public Supabase variables, and ship the first iOS TestFlight build.
2. Set the public support email (`EXPO_PUBLIC_SUPPORT_EMAIL`), then finish App Privacy disclosures, age rating, and Chinese screenshots.
3. Run TestFlight and real-account acceptance (owner/editor/viewer): QR camera scanning, avatars, trip/member management, sheets with the soft keyboard, file picking, and pinch zoom.
4. Finish branches: confirm `split_trip_segment` is live, then branch-scoped Today/Next Step, reunions, and branch-scoped polls.
5. Extend the ledger: exclusions, item-level sub-splits, partial transfers, richer exchange-rate snapshots.
6. Fix Supabase performance-advisor warnings before data grows; enable leaked-password protection before a wider password-login beta.
7. Set conservative Google Places/Routes quotas and budget alerts, then watch usage.
8. Itinerary: Place details, participant/status controls, booking essentials, lodging notes (confirmation, room, check-in instructions, checkout-to-next-stop), and import from shared links.
9. Polls: realtime updates, turning a result into a plan, AI ranking of options.
10. Add commit-bound Vercel Preview browser smoke once CI can resolve the public Preview URL (today the GitHub `Vercel` status exposes only the dashboard link and there is no scoped Vercel credential).
11. If AI editing returns, build it trip-wide behind one preview; decide then whether to retire `suggest-itinerary-edit` and its privacy-policy mention.
12. Replace Open-Meteo for destination search, or stop relying on it for Chinese input. Its CJK index is partial (2026-08-17: `东京` returns a town in China, `伦敦` returns London, Ontario, `清邁`, `大阪` and `首尔` return nothing), so every alias-table entry is debt. Google Places already resolves these through `places-autocomplete`, but switching needs a time-zone source (Google Time Zone API or a coordinate table) and a quota decision.

## Open blockers and pending maintainer steps

- Apple Developer Program enrollment hold blocks EAS/TestFlight.
- Supabase Auth leaked-password protection is off (the only standing security-advisor warning).
- The Supabase Auth redirect allowlist must include `https://tripflow.fun/reset-password`.
- Run `scripts/shrink-existing-avatars.mjs --apply` against production (dry run by default; needs the service-role key in the environment). The CDN may serve old bytes for up to an hour.
- No apply record in this file for `split_trip_segment`, `allow_verified_identity_onboarding`, `trip_polls`, or `auto_settle_on_expense_change`; check the live migration list before relying on them.
- Maintainer acceptance of the ledger currency-settlement recovery (#141) on real data.

## Known verification gaps

- Isolated worktrees have no public Supabase variables, so signed-in browser QA there needs a configured fixture account.
- Not yet verified: physical-device sheet keyboard avoidance and long-form scrolling, native file picking, pinch zoom, signed-in dark mode, live Gemini fallback under load, real audio transcription, and a two-session race on the delay-shift RPC.
- The web console shows a known, harmless native-driver animation fallback warning.
