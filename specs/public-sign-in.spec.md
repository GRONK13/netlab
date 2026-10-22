# Feature: Public sign-in with Google and GitHub

## Overview

NetLab is opening to everyone, not only `@usc.edu.ph` accounts. New accounts sign up with Google or GitHub, which verify the email address; NetLab has no mail server, so it can't verify emails or reset passwords itself. Existing email-and-password accounts keep working.

Decided with the project owner on 2026-10-22:
- Google and GitHub for new accounts; email-and-password only for existing accounts.
- A provider sign-in links to an existing account with the same email, but only when the provider says that email is verified.
- New students choose their leaderboard name, prefilled from the provider.
- One leaderboard for everyone, with a "USC only" filter (push 2).
- A privacy page; a "Delete my account" button (push 2).
- Students can rename themselves; an admin script can rename or hide an account (push 2).

## Functional requirements

- **FR-001 Providers.** The system shall offer a provider only when both its client ID and secret are set, and, in production, `PUBLIC_URL` too.
- **FR-002 Start.** When a student chooses a provider, the server shall create a random state and a PKCE verifier, keep them in httpOnly cookies for 10 minutes, and redirect to the provider.
- **FR-003 Callback checks.** When the provider redirects back, the server shall:
  - reject the callback if the state is missing or doesn't match its cookie;
  - reject it if the provider gives no verified email address;
  - otherwise exchange the code for the student's identity.
- **FR-004 Returning student.** If the identity is already linked to an account, the server shall sign that account in.
- **FR-005 Linking.** If the identity is new but its verified email belongs to an existing account, the server shall link the identity to that account and sign it in. NetLab never verified that account's email, so the server shall also remove its password and end its other sessions; after that, only the provider signs in.
- **FR-006 New student.** Otherwise:
  - the server shall keep the sign-up pending for 15 minutes and ask for a display name;
  - when the student confirms a name of 2–40 characters, it shall create the account, link the identity and sign it in;
  - a pending sign-up shall be usable once.
- **FR-007 Email sign-up.** While any provider is configured in production, the server shall refuse new email-and-password registrations (403), unless `EMAIL_SIGNUP=1`. Email sign-in shall keep working for existing accounts. An account without a password shall never match a password.
- **FR-008 Privacy.** The system shall show a privacy page, reachable signed in or out and linked from sign-in and the welcome step.

## Non-functional requirements

- **Security.**
  - OAuth state and PKCE (Google).
  - Cookies are httpOnly, `SameSite=Lax`, and `Secure` in production.
  - Redirect URLs are built only from `PUBLIC_URL` and fixed paths, so there's no open redirect.
  - The start, callback and complete endpoints are rate-limited.
  - Linking happens only on a provider-verified email.
  - Client secrets live only in the server's `.env`.
- **Privacy.**
  - Only the name, email and account ID are requested (`openid email profile`; GitHub `read:user user:email`).
  - Emails are never shown to other students.
- **Testability.** Providers implement `{ authorizeUrl, identity }`, so tests inject a fake one. The browser tests run `e2e/test-server.ts`, which adds a stand-in provider outside `apps/server`, so production can't offer it.

## Errors

| Condition | Result |
|---|---|
| State missing or mismatched | Redirect to `#/signin?error=expired` |
| Cancelled at the provider | Redirect to `#/signin?error=cancelled` |
| Code exchange or provider API failed | Redirect to `#/signin?error=failed` |
| No verified email | Redirect to `#/signin?error=no-email` |
| Pending sign-up missing or expired | 404 "Your sign-in expired. Start again from the sign-in page." |
| Display name too short | 400 "Enter a display name of at least 2 characters." |
| Email sign-up closed | 403 "New accounts sign up with Google or GitHub." |
| Unknown provider | 404 "No such sign-in provider." |

## Implementation TODO

### Push 1: public sign-in (shipped 2026-10-22, `2fd62c0`)

- [x] Migration 7: nullable `password_hash`, `users.hidden`, `oauth_accounts`, `pending_signups`
- [x] `oauth.ts`: Google and GitHub through arctic; providers, start, callback, pending and complete endpoints
- [x] Email sign-up closes once a provider is configured; password-less accounts never match a password
- [x] Sign-in page with provider buttons, welcome step, privacy page
- [x] API tests with a fake provider; browser test of the sign-up flow through `e2e/test-server.ts`

### Push 2: accounts and moderation

- [ ] Rename and delete account (Account section on the Progress page)
- [ ] Leaderboard "USC only" filter; hidden accounts never listed
- [ ] `scripts/admin.ts`: rename, hide, unhide, find

## Out of scope

Email verification and password reset (need a mail server), more providers, two-factor sign-in.
