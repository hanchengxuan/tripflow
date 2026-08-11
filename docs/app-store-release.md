# App Store release runbook

Last verified: 2026-08-11 UTC

## Code-ready baseline

- iOS bundle identifier: `com.hanchengxuan.tripflow`
- Expo application version: `1.0.0`
- iOS build number starts at `1`; EAS production builds auto-increment it.
- Simplified Chinese display name and native locale are configured.
- The App Store icon is an opaque 1024 × 1024 RGB PNG.
- `eas.json` contains development, internal preview, and production profiles.
- Web and iOS JavaScript exports, Expo Doctor, lint, TypeScript, and tests must all pass before a release build.

## One-time account setup

1. Maintain an active Apple Developer Program membership for the App Store Connect account.
2. Sign into Expo locally with `npx eas-cli login` and verify with `npx eas-cli whoami`.
3. Create the App Store Connect app using bundle ID `com.hanchengxuan.tripflow`.
4. Add production Supabase public environment variables to the EAS project. Never add a service-role key to EAS client variables.

## Release commands

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Submission uploads the binary to App Store Connect/TestFlight. It does not complete App Review automatically.

## Required before App Review

- In-app account deletion is implemented and backed by the `account_deletion` migration. Re-test it in TestFlight before submission.
- Privacy and support pages are published by the app at `/privacy` and `/support`; configure `EXPO_PUBLIC_SUPPORT_EMAIL` before public review.
- Complete App Privacy disclosures for Supabase/Vercel and any later analytics, crash, speech, or AI providers.
- Simplified Chinese name, subtitle, description, keywords, URLs, and review-note draft live in `docs/app-store-metadata-zh-CN.md`; add the final support contact, age rating, and screenshots.
- Run TestFlight acceptance on at least one current iPhone for login links, date/time controls, invitations, profile editing, itinerary creation, and expense splitting.
- Provide App Review with a usable review account or clear passwordless-login instructions.

## Current Apple toolchain requirement

Uploads on or after 2026-04-28 must be built with Xcode 26 or later and the iOS 26 SDK. Use the current EAS production image when starting the release build.
