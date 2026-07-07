---
title: Signing in & two-step verification
audience: [member, team-manager, company-admin, platform-admin]
module: platform
feature: authentication
permissions: []
path: /login
countries: [all]
status: live
locale: en
updated: 2026-07-07
---

# Signing in & two-step verification

Your account is protected by a password **and** a 6-digit code from an authenticator app. Both are always required — there is no way to opt out, because company data (payslips, contracts, finances) must never sit behind a password alone.

## Create an account

**Navigation: `/signup`**

1. Enter your name, email and a password (at least 8 characters).
2. Depending on your environment you may receive a **confirmation email** — open the link to activate the account.
3. You are then taken directly to two-step verification setup — this is required before anything else.

## Set up two-step verification (first sign-in)

**Navigation: automatic after first sign-in (`/2fa/enroll`)**

1. Install an authenticator app if you don't have one — Google Authenticator, Microsoft Authenticator, 1Password, Aegis…
2. In the app, choose *scan QR code* and point the camera at the code on screen. If you can't scan, type the key shown below the QR code instead.
3. Enter the 6-digit code the app displays and press **Activate**.

From now on the app generates a fresh code every 30 seconds; you'll need it whenever you sign in.

## Signing in day-to-day

**Navigation: `/login`**

1. Email + password.
2. The 6-digit code from your authenticator app.

You stay signed in on your device for a while; when the session expires you'll simply be asked again.

## Lost your phone?

Your authenticator codes live on your phone, so a lost or reset phone means you can't complete step 2. **Contact your company administrator or support** — after confirming your identity they can reset two-step verification so you can enroll again on a new device.

> Self-service recovery codes are planned; until then the reset always goes through a person, on purpose.

## Common problems

| Symptom | Fix |
|---|---|
| "That code didn't match" | Codes rotate every 30 seconds — type the one currently shown. Check your phone's clock is set to automatic. |
| "Wrong email or password" | Both are checked together; retype both. Use *Create one* on the sign-in screen if you never registered. |
| "Too many attempts" | Wait a minute; the limit protects your account from guessing. |
