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
