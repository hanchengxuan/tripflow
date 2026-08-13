# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Project context protocol

At the start of every TripFlow task:

1. Read `PROJECT_CONTEXT.md` and `planning.md`.
2. Check `git status --short --branch` and the latest commits.
3. If the request continues a Discord discussion and details are missing, recover the latest 50 messages from the `#tripflow` channel before making assumptions.
4. Check the live Supabase migration list before changing database objects.

After a meaningful milestone, update `PROJECT_CONTEXT.md` with the verified current state, next action, decisions, and blockers. Commit that update with the implementation. Keep the pinned `#tripflow` summary short and point it back to this file.

Never record credentials, access tokens, database passwords, service-role keys, personal data, or private conversation details in project context.

## Development discipline

- Make the smallest change that fully solves the stated problem. Diagnose the existing behavior before replacing its approach, and use `git blame` when a product or compatibility decision is unclear.
- Respect deliberate user simplifications and removals. Do not reintroduce reverted behavior without new evidence and explicit scope.
- Keep one PR to one purpose. Separate unrelated fixes, refactors, and feature work; do not bundle “while here” cleanup.
- Read the full changed file and its callers before editing. Reuse existing components, hooks, domain functions, repository methods, and design tokens before creating new ones.
- Comments are rare and short. Add one only for a constraint, invariant, external provider quirk, or non-obvious safety boundary that code cannot express.
- Never silence TypeScript with `as any`, `@ts-ignore`, or `@ts-expect-error`. Use assertions only after runtime validation or a real narrowing boundary.
- Format and lint only files in scope. Do not run bulk rewrites over untouched files.
- Documentation for durable product and engineering behavior belongs in the relevant tracked context or `docs/`; onboarding and commands belong in `README.md`.

### Component and state boundaries

- New screen and component files should stay below 500 lines. Existing files above that threshold are legacy boundaries: do not grow them with a new state concern when it can be extracted safely.
- Before modifying a component over 300 lines, check its line count and existing hooks, read it in full, and identify the narrowest extraction boundary.
- A new coordinated state concern—multiple hooks for one async workflow, debouncing, optimistic updates, reconciliation, or scrolling—belongs in a focused hook or child component.
- Prefer one responsive component with shared data and state over separate mobile and desktop implementations that can drift.
- Preserve web/native parity intentionally. Platform-specific files are appropriate only when the platform behavior genuinely differs.

### Verification boundaries

- A passing generic command is evidence only for behavior it actually covers. Add focused regression tests for deterministic money, time, authorization, and state-transition bugs.
- User-visible changes require browser verification at mobile and desktop widths, including console/network errors and accessibility state.
- Expo/native changes require the relevant SDK 57 documentation, Expo Doctor, and platform export or device/build evidence.
- Database changes require the live migration check, backward-compatible migration review, generated type refresh, transactional acceptance, and post-apply RLS/security verification.
- Workflow changes require validating permissions, concurrency, exact-commit selection, failure behavior, and the checks that branch protection will actually require.

## Project skills

- Use `$tripflow-review` for pre-landing review or when asked whether a branch is safe to merge.
- Use `$tripflow-qa` for diff-aware browser QA on local, Preview, or production targets.
- Use `$tripflow-ship` when asked to publish or finish a change; it continues through PR gates, merge, exact production deployment, and smoke verification.

## Shared Git workflow

All agents share this checkout, so never develop directly on `main` and never reset or discard another agent's work.

1. Start from a fresh local view of `main`: inspect status and recent commits, then create a focused `codex/<short-topic>` branch.
2. Every feature, fix, design slice, or workflow change gets its own focused `codex/<short-topic>` branch and its own PR. Keep one coherent change per branch/PR; do not batch unrelated features for a later merge. Commit implementation, tests, and the matching `PROJECT_CONTEXT.md` update together when they belong to the same milestone.
3. Before pushing, fetch the latest `origin/main`, rebase the branch onto it, and resolve conflicts by preserving the newest compatible behavior from both sides. Run the relevant checks again after the rebase.
4. Push the branch and open a non-draft PR with a concise summary, verification evidence, migration notes, and any known blockers. Do not claim a PR is mergeable until the live base branch and checks confirm it.
5. As soon as required CI, preview, and review gates pass, merge that PR into `main` immediately; do not wait to bundle it with later work. Then update local refs and verify the production CD run for the merge commit. A feature is not complete until its production deployment and relevant smoke tests pass.
6. If GitHub, CI, Vercel, or deployment access is unavailable, keep the branch and commit intact and report the exact authentication or remote error; do not rewrite history to pretend it was merged or deployed.
7. When another agent is active, communicate the branch name, commit SHA, files in scope, and any migration/deployment dependency. Preserve useful uncommitted work in a named stash before switching branches.

Never commit secrets or paste tokens into chat, workflow files, project context, or PR descriptions.
