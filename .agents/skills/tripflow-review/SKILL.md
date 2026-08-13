---
name: tripflow-review
description: Review a TripFlow feature branch before landing. Use for PR reviews, pre-merge audits, regression-risk checks, or when asked whether a TripFlow change is safe to ship. Inspect the branch against origin/main with full-file context and report evidence-backed findings across Expo web/native behavior, Supabase authorization, money and time invariants, accessibility, tests, and project continuity. Remain read-only for source code.
---

# TripFlow Review

Perform a staff-level, read-only review of the current branch. Prioritize real correctness and security failures over style preferences.

## Preflight

1. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, and the relevant sections of `planning.md`.
2. Run `git status --short --branch`, `git fetch origin main`, `git log origin/main..HEAD --oneline`, and `git diff origin/main...HEAD --stat`.
3. Refuse to review `main` or an empty diff. Preserve unrelated working-tree changes.
4. Recover missing Discord context only when the request continues an incomplete `#tripflow` discussion.
5. Read the exact Expo SDK 57 documentation before judging Expo APIs or configuration.

## Establish intent and scope

Infer intent from the user request, PR description, commit subjects, and branch name. Read every changed file in full where practical, then inspect its callers, tests, types, migrations, and nearby established patterns. Use `git blame` when the reason for existing behavior is unclear.

Classify the diff so checks stay relevant:

- `src/app`, `src/components`, `src/features`: user flow, accessibility, localization, web/native parity.
- `src/domain`, ledger code: integer minor units, deterministic remainder allocation, settlement invariants.
- `src/data`, `src/lib/supabase.ts`, `supabase/`: authentication, authorization, RLS/RPC/storage, migrations, generated database types.
- route dates, itinerary, lodging: trip timezone, cross-day ranges, daylight-saving and boundary behavior.
- workflows, config, scripts: permissions, exact-commit gates, secret handling, failure behavior.

## Review passes

Check only reachable, user-relevant risks and cite exact files and lines.

1. **Correctness:** invalid states, stale closures, races, partial failure, retries, loading/recovery behavior, destructive confirmation, error translation.
2. **Security and privacy:** client-side trust, RLS/RPC bypass, storage access, unsafe deep links, leaked secrets or personal data, authorization enforced only in UI.
3. **Money and time:** floating-point money, non-deterministic allocation, unaudited conversion, inconsistent source/base totals, timezone conversion and interval boundaries.
4. **Expo platforms:** SDK 57 compatibility, unsupported web/native APIs, permissions, deep links, camera/media behavior, export-time failures.
5. **UI quality:** narrow-screen overflow, dark mode, semantic roles and checked/disabled state, keyboard/focus behavior, Chinese/English parity.
6. **Data compatibility:** additive migration safety, live schema assumptions, generated `src/types/database.ts` drift, old clients continuing to work.
7. **Missing evidence:** absent regression tests, missing browser coverage, stale product/design/project context, or verification that does not exercise the changed behavior.

Run proportionate read-only checks such as `git diff --check`, lint, TypeScript, focused Jest, Expo Doctor, and exports. Do not treat a green generic test as proof unless it covers the changed requirement.

## Findings

Use these severities:

- **critical:** exploitable authorization/privacy failure, data loss/corruption, production outage.
- **high:** reachable broken core flow, wrong money result, runtime crash, schema/client incompatibility.
- **medium:** meaningful edge-case regression, missing rollback/error handling, important untested behavior.
- **low:** localized maintainability, accessibility, or consistency issue with limited impact.

Every finding must include:

- concise title;
- absolute file path and tight line range;
- concrete failure scenario and user impact;
- confidence from 1–10;
- smallest compatible fix and verification needed.

Suppress speculative findings below confidence 5. Deduplicate shared root causes. Do not report pre-existing issues unless the branch worsens or newly exposes them.

## Verdict

Finish with one verdict:

- `CLEAR`: no actionable findings.
- `MERGE-WITH-CARE`: only medium/low findings; list required PR notes.
- `STOP`: any critical/high finding or missing evidence that prevents correctness from being established.

If clear, say so directly and mention any residual verification gap. Never edit source, commit, push, approve, or merge while running this skill.
