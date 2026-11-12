# Sign in

A person enters their email on the site's sign-in page, gets an email with a link and a six-digit code, and enters the code or follows the link. The API sets the `airdesign.session` cookie and the person lands in the app. Signed out, the app sends the person to sign-in with the page they wanted.

## Sub-features

- `signin-email` `signInRoutes.email` with an email answers 202 and sends the mail `Sign in to AirDesign` with a text part (a heading, a blank line, then the code on line 3) and a designed HTML part with the code, a `Sign in to AirDesign` button and the expiry line. At most 5 mails per address in 15 minutes; past that it still answers 202 and sends nothing.
- `signin-mail` the HTML part renders light and dark. Journey `sign-in-mail` captures both.
- `signin-code` `signInRoutes.code` with the email and code answers 200 and sets `airdesign.session`. A wrong code answers 401 `code`.
- `signin-link` `signInRoutes.link` (GET) signs in from the emailed link and redirects to `/`; a used or bad link redirects to the site's `/sign-in/expired`. In this stack the link's host is `https://app.example`, so rewrite it to the run's origin to follow it.
- `signin-session` with the cookie, `deckRoutes.list` answers 200 with the account email; without it, 401 `session`.
- `signin-form` the site page `/sign-in` with `Email` and `Continue with email`, then `/sign-in/check`, which sends the code as soon as six digits are typed, with `Send again`. Both call the API with same-origin paths.

## How to get to it (user POV)

- `/sign-in` on the site, reached from its header.
- An app page whose first call answers 401 `session` goes to the sign-in address built into `apps/web` (`VITE_SIGN_IN_URL`, `https://airdesign.app/sign-in` in the production build this stack serves) with `?next=<path>`.
- The link in the sign-in email.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Email and code.** `$V sign-in <run>`. Prints `{"email":"verify<hex>@example.com","cookie":"airdesign.session=..."}`. The run's scratch `mail.jsonl` holds the mail that carried the code.
- **Session works.** `$V api <run> list '{}' --cookie '<cookie>'`. Status 200 and the saved JSON has `account.email` equal to the email.
- **No session.** `$V api <run> list '{}'`. Status 401 and `refusal` `session`.
- **In the browser.** In a journey, `signIn()` does the same two calls and puts the cookie on the browser. Home then shows `button "New deck"`.
- **The mail.** `kit.mail(email)` returns the last mail sent to that address and saves it as `mail.json` in the journey's evidence dir. `$V journey <run> sign-in-mail` renders its HTML with `page.setContent` and captures it light and dark.
- **Signed out.** The journey kit answers every `airdesign.app` address with a stand-in page, so a sign-in redirect never reaches production. Assert the URL the app asked for, as `delete-account` does.
- **Site pages.** `$V journey <run> sign-in-pages` walks the real path: `${siteOrigin}/sign-in` empty, with `a@b` (the API refuses it), the code step on `/sign-in/check`, a wrong code, the emailed code typed with a space in it, the app home signed in, Sign out in Settings landing on the site's `/sign-in?next=%2Fsettings%2Faccount`, the emailed link signing in, and the same link used twice landing on `/sign-in/expired`. Each page is captured at 1470 px and at 390 px, and every capture is a state for `look` and `sheet`: `sign-in-empty`, `sign-in-bad-email`, `check-email`, `code-wrong`, `signed-out`, `link-expired`, each with a `-phone` twin. A code or link that expired by the clock cannot be reached in a run; a used link and an expired one take the same API path.

## Gotchas

- Mail does not leave the machine. The stack's sender writes each mail, HTML included, to `mail.jsonl` in `~/tmp/verify-airdesign-scratch/<run>/`, which `stop` removes. `kit.mail` copies the one you read into the evidence dir.
- Reusing one address with `--email` more than 5 times in 15 minutes reads a stale code.
- The cookie is `Secure`. Chromium accepts it on `http://127.0.0.1` only when it is set through `context.addCookies`, as `signIn()` does.
- Each call to `$V sign-in` makes a new account unless you pass `--email`.
