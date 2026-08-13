---
name: tripflow-qa
description: Run diff-aware browser QA for TripFlow on local Expo Web, a Vercel Preview, or production. Use after UI, routing, authentication, itinerary, invitation, profile, or ledger changes; before a PR is merged; or when asked to smoke-test a deployment. Map changed files to affected routes, exercise real interactions at mobile and desktop widths, inspect console and network failures, and remain read-only unless the user explicitly requests fix mode.
---

# TripFlow QA

Test TripFlow like a traveller, scoped to the branch diff by default. Use the automated Playwright suite as a baseline, then perform targeted exploratory checks when browser-control tools are available.

## Modes and safety

- Default: diff-aware, read-only QA against local Expo Web.
- `--quick`: login entry plus `/privacy` and `/support`.
- `--full`: every reachable public route and authenticated core tab.
- `<url>`: use the supplied Preview or production URL.
- `--fix`: local branch only; make minimal fixes and re-verify each finding.

Never use dev-login bypasses, invented credentials, destructive actions, or fixture writes against Preview or production. Authenticated write flows require an explicitly supplied test account and throwaway data with a verified cleanup path. Never place credentials in screenshots, logs, commits, or reports.

## Preflight

1. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, and relevant product/design context.
2. Run `git status --short --branch`, fetch `origin/main`, and inspect `git diff origin/main...HEAD --name-only`.
3. Set the target to the user-supplied URL or `http://localhost:4199`.
4. If local is not running, start `npm run web -- --port 4199` in a persistent terminal and wait for HTTP readiness.
5. Run `npm run test:e2e` when Playwright is installed. Treat it as baseline evidence, not a substitute for changed-flow checks.

## Map changes to routes

- `src/app/index.tsx`, Today components, itinerary/time/route features → `/` after auth.
- `src/app/explore.tsx`, invites, trip/member data → `/explore`.
- `src/app/ledger.tsx`, money/AI/receipt/settlement code → `/ledger`.
- `src/app/profile.tsx`, auth/profile/avatar/account deletion → `/profile`.
- `src/app/privacy.tsx` or privacy processors → `/privacy`.
- `src/app/support.tsx` or support configuration → `/support`.
- shared components, providers, theme, i18n, shell, navigation → login entry plus at least two representative authenticated tabs.
- docs, workflows, tests, or database-only diffs with no visible surface → run `--quick` rather than inventing a route.

## Exercise each route

For every selected route:

1. Navigate directly and confirm the intended page renders.
2. Capture a screenshot and accessibility snapshot.
3. Inspect console errors and failed network requests.
4. Exercise controls introduced or changed by the diff, then verify the resulting state instead of only verifying clickability.
5. Check one 390×844 mobile viewport and one 1280×800 desktop viewport for UI changes.
6. Verify keyboard focus, semantic role/state, dark mode, and Chinese/English labels when relevant.
7. For async flows, confirm visible progress, success, recoverable failure, and no duplicate submission.

Use existing test fixtures and documented acceptance procedures. Do not mutate real user data. If a backend flow cannot be safely exercised, report the exact missing prerequisite rather than claiming success.

## Fix mode

Only enter fix mode when explicitly requested and the local working tree has no unrelated changes.

For each finding, make the smallest source fix, run the focused automated test, repeat the exact browser reproduction, and check for new console errors. Add a regression test when deterministic behavior can be covered. Stop after a repeated failed fix or when resolution needs a product, schema, credential, or infrastructure decision.

## Report

Classify findings as critical, high, medium, or low. Include route, viewport, reproduction, user impact, console/network evidence, and screenshot/trace path. End with:

`QA: N routes, M interactions, X issues (critical A, high B, medium C, low D).`

If no issue is found, state what was actually covered and any authenticated or native-device flow that remains unverified.
