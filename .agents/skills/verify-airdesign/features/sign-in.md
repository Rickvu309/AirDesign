# Sign in

A person enters their email on the site's sign-in page, gets an email with a link and a six-digit code, and enters the code or follows the link. The API sets the `airdesign.session` cookie and the person lands in the app. Signed out, the app sends the person to sign-in with the page they wanted.

## Sub-features

- `signin-email` `signInRoutes.email` with an email answers 202 and sends a mail whose second line is the code.
- `signin-code` `signInRoutes.code` with the email and code answers 200 and sets `airdesign.session`.
- `signin-link` `signInRoutes.link` (GET) signs in from the emailed link.
- `signin-session` with the cookie, `deckRoutes.list` answers 200 with the account email; without it, 401 `session`.
- `signin-form` the site page `/sign-in` with `Email` and `Continue with email`, then `/sign-in/check` with the six-digit code entry.

## How to get to it (user POV)

- `/sign-in` on the site, reached from its header.
- Any app page while signed out redirects to `/sign-in?next=<path>`.
- The link in the sign-in email.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Email and code.** `$V sign-in <run>`. Prints `{"email":"verify<hex>@example.com","cookie":"airdesign.session=..."}`. The run's scratch `mail.jsonl` holds the mail that carried the code.
- **Session works.** `$V api <run> list '{}' --cookie '<cookie>'`. Status 200 and the saved JSON has `account.email` equal to the email.
- **No session.** `$V api <run> list '{}'`. Status 401 and `refusal` `session`.
- **In the browser.** In a journey, `signIn()` does the same two calls and puts the cookie on the browser. Home then shows `button "New deck"`.
- **Site form.** Not served by this stack. Report `signin-form` as not verified here. To verify it, build the site with `pnpm --filter @airdesign/site... run build` and drive `/sign-in` in its own preview, noting that it posts to the API base the site is configured with.

## Gotchas

- Mail does not leave the machine. The stack's sender writes each mail to `mail.jsonl` in `~/tmp/verify-airdesign-scratch/<run>/`, which `stop` removes. Copy a mail into the evidence dir if it is the proof.
- The cookie is `Secure`. Chromium accepts it on `http://127.0.0.1` only when it is set through `context.addCookies`, as `signIn()` does.
- Each call to `$V sign-in` makes a new account unless you pass `--email`.
