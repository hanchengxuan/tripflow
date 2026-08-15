# Password flows: change and reset

Specification for the two missing password flows, plus the state of the one that already exists. Written from a read of `src/features/auth/auth-service.ts`, `src/features/auth/auth-screen.tsx`, `src/app/_layout.tsx`, and `src/app/profile.tsx`.

Design for the auth screens: `.design/tripflow-ui-2.0/screens-auth.html`. Follow `$tripflow-ui`.

## Already implemented — do not rebuild

**Choosing a password during registration.** `completeRegistration()` accepts `password` and applies it through `auth.updateUser`. `validatePassword` requires 8+ characters with at least one letter and one digit. The onboarding gate makes this mandatory for email registration. The design's registration frame matches this; only its layout and copy need porting.

## 1. Change password while signed in

**Where:** Profile → 账号与安全, a new row above 退出登录.

**The security problem to solve first.** `supabase.auth.updateUser({ password })` succeeds on the strength of the session alone — it does not ask for the current password. Anyone holding a hijacked or borrowed session can silently take over the account. Do not ship the bare call.

Re-authenticate before updating:

1. Ask for the current password.
2. Verify it with `signInWithPassword(currentEmail, currentPassword)`. A failure means wrong password — surface that, do not proceed.
3. Only then call `updateUser({ password: validatePassword(next) })`.
4. Require the new password twice and reject a match with the current one.

Accounts created through Google have no password. Detect that (`session.user.app_metadata.providers`) and offer **设置密码** instead of **修改密码**, skipping step 2 — there is nothing to re-authenticate against. Say so in the UI rather than silently branching.

**Service additions** — `auth-service.ts`:

```ts
export async function changePassword(currentPassword: string, nextPassword: string)
export async function setInitialPassword(nextPassword: string)  // provider-only accounts
```

Both normalise and validate before touching the network, and translate errors through `toUserMessage`.

## 2. Forgot password

Four steps, and the two middle ones are configuration rather than code.

### 2.1 Request

On the sign-in screen, `忘记密码？` sits beside `用密码登录` (see the design's `switchrow`). It sends:

```ts
supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo })
```

**Always report success**, even for an address with no account. Confirming which emails are registered is an account-enumeration leak. Copy: 「如果这个邮箱有账号，重置链接已发送。」

### 2.2 Redirect configuration — required, easy to miss

`redirectTo` must be on Supabase Auth's allowed redirect list, or the link silently drops the user on the Site URL with no session.

Register both:
- production: `https://tripflow-liart.vercel.app/reset-password`
- local development: the dev server origin

This is the same class of problem that already bit this project: an emailed link obeys the Supabase **Site URL**, not wherever the user started. A tester on a dev server who clicks the emailed link lands on production. Say so in the QA notes.

### 2.3 Recovery route

New route `src/app/reset-password.tsx`.

Supabase delivers recovery by putting the user into a **real but limited session** and emitting `PASSWORD_RECOVERY` on `onAuthStateChange`. Two consequences:

- `_layout.tsx` currently routes any authenticated session into the product, and an incomplete profile into onboarding. A recovery session would be swept into one of those before the user can set a password. The route guard must let `/reset-password` through ahead of both checks.
- The recovery session is enough to call `updateUser({ password })`. No current password, and no re-authentication, because possession of the mailbox is the proof.

The screen itself is the design's registration frame minus the avatar and name: new password, confirm, one primary action. On success, sign the user out and send them to sign-in, so the new password is exercised once immediately.

### 2.4 Expiry

Recovery links expire. An expired link produces a session-less arrival at `/reset-password` — render an error state offering to request a new link, not a blank form that will fail on submit.

## Verification

Static gates are not evidence for any of this.

- **Change password:** wrong current password rejected; correct one succeeds; the new password signs in and the old one does not; a Google-only account gets the 设置密码 path.
- **Reset:** unknown address returns the same message as a known one; the link lands on `/reset-password` with a usable session; an expired link shows the error state; after reset the old password fails.
- Run both at 375px and desktop, light and dark, checking console errors.

Use a disposable test account. Do not exercise these against the maintainer's own account — a mistake locks it.

## Scope note

These are three separate purposes and should not share a branch: the auth screen re-skin, change-password, and reset-password each land on their own `codex/*` branch with its own PR, per `AGENTS.md`.
