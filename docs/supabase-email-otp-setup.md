# Supabase email OTP setup

TripFlow registration and email-code sign-in use a fixed eight-digit Supabase Email OTP. Production must configure both email and SMS OTPs to issue eight digits.

## Required dashboard change

1. Open Supabase Dashboard → **Authentication → Email Templates → Magic Link**.
2. Set the subject to `Your TripFlow verification code`.
3. Replace the body with:

```html
<h2>Your TripFlow verification code</h2>
<p>Enter this eight-digit code in TripFlow:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
```

4. Save the template. Do not include `{{ .ConfirmationURL }}` in this template; that variable makes `signInWithOtp` send a Magic Link instead of the code TripFlow requests.
5. Under **Authentication → Providers → Email**, keep email signups enabled, set **Email OTP Length** to `8`, and set **Email OTP Expiration** to `600` seconds (10 minutes).
6. Under **Authentication → Rate Limits**, set the minimum interval for sending another email OTP / magic link to `30` seconds. The TripFlow UI uses the same 30-second resend cooldown.
7. Request a code from both **Register** and **Email code** in production. Confirm the email contains eight digits, not a confirmation link. After resending, verify that only the newest code works; Supabase replaces the previous one-time token when a new code is issued.

## Google, phone, and identity linking

- Enable Google under **Authentication → Providers → Google**, configure its client ID/secret, and add the Supabase callback URL to Google Cloud.
- Enable phone signups and configure an SMS provider. Set the SMS OTP length to `8`, expiry to `600` seconds, and resend interval to `30` seconds.
- Enable **Manual identity linking** so a signed-in user can attach a Google identity with a different verified email.
- Change the **Change Email Address** template to use `{{ .Token }}` rather than `{{ .ConfirmationURL }}` so adding an email uses the same eight-box code screen.
- Supabase automatically links a Google identity when its verified email matches an existing account. A phone number or a different Google identity must be linked while signed in; never create-and-merge accounts silently.

The invite token remains in the TripFlow URL or app deep link during authentication. OTP verification never auto-joins a trip; the traveler completes onboarding and then confirms the invite.

Official reference: https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp
