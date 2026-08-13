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

## Shared Git workflow

All agents share this checkout, so never develop directly on `main` and never reset or discard another agent's work.

1. Start from a fresh local view of `main`: inspect status and recent commits, then create a focused `codex/<short-topic>` branch.
2. Keep one coherent change per branch/PR. Commit implementation, tests, and the matching `PROJECT_CONTEXT.md` update together when they belong to the same milestone.
3. Before pushing, fetch the latest `origin/main`, rebase the branch onto it, and resolve conflicts by preserving the newest compatible behavior from both sides. Run the relevant checks again after the rebase.
4. Push the branch and open a non-draft PR with a concise summary, verification evidence, migration notes, and any known blockers. Do not claim a PR is mergeable until the live base branch and checks confirm it.
5. After approval/checks pass, merge the PR into `main`, then update local refs. If GitHub access is unavailable, keep the branch and commit intact and report the exact authentication or remote error; do not rewrite history to pretend it was merged.
6. When another agent is active, communicate the branch name, commit SHA, files in scope, and any migration/deployment dependency. Preserve useful uncommitted work in a named stash before switching branches.

Never commit secrets or paste tokens into chat, workflow files, project context, or PR descriptions.
