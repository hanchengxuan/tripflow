---
name: tripflow-ship
description: Land a completed TripFlow branch through the repository's full delivery workflow. Use when the user asks to ship, publish, open or finish a PR, merge a TripFlow change, or carry work through CI and production verification. Rebase on origin/main, run change-appropriate Expo/Supabase/browser checks, update project context, create a non-draft PR, wait for required gates, merge promptly, and verify the exact production commit and smoke tests.
---

# TripFlow Ship

Carry one coherent TripFlow change all the way to verified production. Do not stop at creating a PR when required gates can still be completed.

## Preflight

1. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `planning.md`, and the latest commits.
2. Confirm the branch is `codex/<focused-topic>`, not `main`, and inspect all working-tree changes.
3. Stop for unrelated changes, unresolved conflicts, secrets, or a branch that contains more than one PR purpose. Preserve other work rather than resetting it.
4. Read the exact Expo SDK 57 documentation before changing or validating Expo code.

## Sync and classify

Fetch `origin/main`, rebase the branch onto it, and resolve conflicts by preserving the newest compatible behavior from both sides. Never replace this repository's rebase policy with a merge commit.

Classify the complete `origin/main...HEAD` diff:

- app/domain/UI change;
- Expo/native configuration;
- Supabase migration, function, RLS/RPC, storage, or generated type change;
- workflow/deployment change;
- docs/context only.

## Quality gates

Always run `git diff --check`, lint, TypeScript, and Jest. Run the remaining checks when relevant:

- Web UI or routing: web export and `npm run test:e2e`.
- Expo/native code or configuration: Expo Doctor and iOS export.
- Money/time logic: focused deterministic tests covering remainder, conversion, timezone, and boundary behavior.
- Supabase objects: inspect the live migration list before edits, validate/apply through the approved Supabase workflow, regenerate database types, run transactional acceptance, and recheck RLS/security advisors. Never deploy a destructive schema assumption silently.
- Workflow/CD: validate YAML behavior, permissions, concurrency, exact-commit status selection, and failure paths.

Run `$tripflow-review`. Resolve every `STOP` finding before continuing. Run `$tripflow-qa` for user-visible changes and retain its coverage summary.

## Commit and PR

Update `PROJECT_CONTEXT.md` after the milestone with verified current state, next action, decisions, and blockers. Do not add secrets or private discussion details.

Stage files by explicit path. Use a conventional commit that contains implementation, tests, and the matching context update when they form one milestone. Fetch and rebase again if `origin/main` advanced, then rerun relevant checks.

Push the branch and open a non-draft PR to `main` containing:

- concise summary of the single purpose;
- exact commands and browser/backend evidence actually obtained;
- migration and rollback notes, or an explicit statement that there is no migration;
- known blockers or unverified native/device paths.

Never claim a check was run when it was not.

## Land and verify

Wait for required CI, Vercel Preview, and review gates. Address actionable failures without broadening the PR. Once all required gates pass and the branch is still current with `main`, merge immediately.

After merge:

1. Update local refs and identify the exact merge commit.
2. Wait for `.github/workflows/deploy-production.yml` for that commit.
3. Verify that the Vercel status belongs to the same SHA and production smoke tests passed.
4. Perform relevant public and authenticated smoke tests without leaving fixtures.
5. Refresh the pinned `#tripflow` summary when connector access is available, keeping it short and pointing to `PROJECT_CONTEXT.md`.

The change is complete only when the exact production deployment and relevant smoke tests pass. If access is unavailable, keep the branch and commits intact and report the exact authentication, CI, preview, review, or deployment blocker.
