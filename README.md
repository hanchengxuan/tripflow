# TripFlow

TripFlow is a collaborative travel workspace for groups that travel together, split into parallel branches, and reunite later. The first deployable MVP covers open email registration with profile onboarding, password or email-code sign-in, shared trips and invitations, a live itinerary, and equal-split multi-currency expenses backed by Supabase Row Level Security.

Production MVP: <https://tripflow-liart.vercel.app>

Public pages: [Privacy](https://tripflow-liart.vercel.app/privacy) · [Support](https://tripflow-liart.vercel.app/support)

## MVP flow

1. Sign in from an emailed secure link or six-digit OTP.
2. Create a trip, or join one with a 48-character invite code.
3. Add itinerary items to the shared Today timeline.
4. Record an expense manually or describe it in natural language, review the AI-filled draft, then save an exact equal split.
5. Review per-currency balances and suggested settlement transfers.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key. Set `EXPO_PUBLIC_SUPPORT_EMAIL` before public distribution. Never use a service-role key in the app.

3. Validate the project

   ```bash
   npm run validate
   ```

4. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project structure

- `src/app`: Expo Router screens.
- `src/domain`: framework-independent trip and ledger rules.
- `supabase/migrations`: database schema and Row Level Security policies.
- `planning.md`: consolidated product scope and delivery plan.
- `PROJECT_CONTEXT.md`: verified current state, decisions, next work, and continuity protocol.

The MVP screens read and write live Supabase data. Never commit Supabase secrets; local environment files are ignored.

The natural-language expense parser runs only in a Supabase Edge Function. Configure `GEMINI_API_KEY` in Supabase Edge Function Secrets; never expose it through an `EXPO_PUBLIC_*` variable or commit it to Git.

## Deploy the web MVP

The repository includes `vercel.json` for a static Expo web deployment.

1. Import the GitHub repository into Vercel.
2. Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the public `EXPO_PUBLIC_SUPPORT_EMAIL` to the Vercel project environment.
3. Deploy. Vercel runs `npm run build:web` and serves `dist`.

Before a release, run:

```bash
npm run validate
npm run build:web
npx expo-doctor
```

### CI/CD

GitHub Actions runs formatting checks, lint, TypeScript, Jest, a production-dependency audit, and the Expo web export on every pull request and on `main`. A push to `main` starts the production workflow only after that quality gate passes; it pulls the production Vercel environment, builds a prebuilt artifact, deploys it, and smoke-tests both the deployment URL and the public production alias.

Configure these GitHub Actions secrets before enabling automatic deployment:

- `VERCEL_TOKEN`: a Vercel token with access to the project;
- `VERCEL_ORG_ID`: the Vercel team/user ID;
- `VERCEL_PROJECT_ID`: the TripFlow Vercel project ID.

The Vercel project must also contain `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_SUPPORT_EMAIL` in its production environment. The deploy workflow intentionally does not store or expose those values in Git.

For email-link sign-in on the deployed site, add the deployment URL to Supabase Auth's allowed redirect URLs. To show a six-digit code in the email, configure the email template with Supabase's `{{ .Token }}` variable; the default magic link already works on web.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
