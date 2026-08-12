# Supabase email OTP setup

TripFlow registration and email-code sign-in use a numeric Supabase Email OTP. TripFlow accepts the hosted Supabase-supported 6–10 digit range, while production should be configured to issue six digits for the simplest experience. The hosted project sends a Magic Link by default until its email template is changed.

## Required dashboard change

1. Open Supabase Dashboard → **Authentication → Email Templates → Magic Link**.
2. Set the subject to `Your TripFlow verification code`.
3. Replace the body with:

```html
<h2>Your TripFlow verification code</h2>
<p>Enter this six-digit code in TripFlow:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
```

4. Save the template. Do not include `{{ .ConfirmationURL }}` in this template; that variable makes `signInWithOtp` send a Magic Link instead of the code TripFlow requests.
5. Under **Authentication → Providers → Email**, keep email signups enabled, set **Email OTP Length** to `6`, and set **Email OTP Expiration** to `600` seconds (10 minutes).
6. Under **Authentication → Rate Limits**, set the minimum interval for sending another email OTP / magic link to `30` seconds. The TripFlow UI uses the same 30-second resend cooldown.
7. Request a code from both **Register** and **Email code** in production. Confirm the email contains six digits, not a confirmation link. After resending, verify that only the newest code works; Supabase replaces the previous one-time token when a new code is issued.

The invite token remains in the TripFlow URL or app deep link during authentication. OTP verification never auto-joins a trip; the traveler completes onboarding and then confirms the invite.

Official reference: https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp
