# Delete account

The account button at the top of the side navigation (on Home, Trash and every Settings page) opens a menu with `Usage`, `Agents`, `Account`, `Delete account` and `Sign out`, and the `Account` tab in Settings (`/settings/account`) shows the signed-in email with `Sign out` and `Delete account` buttons. Either opens the dialog `Delete your account?`, which names what goes (`Your decks, Trash and connected agents are deleted for good. This can't be undone.`) and asks for the signed-in email. Once the email is typed, `Delete account` deletes the account on the server with every deck, stored original, session, agent connection and Aira usage it holds, removes the browser's copy of the decks, and goes to sign-in with `next` set to the page it was on.

## Sub-features

- `delete-ask` the dialog `Delete your account?` has `button "Delete account"`, which stays disabled until the typed email matches the signed-in one. `Cancel` closes it and sends nothing.
- `delete-server` `accountRoutes.delete` with `{ email }` answers 200 and clears the session cookie the way sign-out does. Any other email answers 400 `field`.
- `delete-credentials` afterwards the old cookie answers 401 `session` everywhere, and the person's agent access and refresh tokens are refused.
- `delete-originals` the person's stored originals are deleted from the store; a download link issued before answers 404.
- `delete-device` the browser holds no `airdesign` IndexedDB database.
- `delete-again` the same email can sign in again and starts with no decks.

## How to get to it (user POV)

- Sign in, open `/`, click the account button with the email in the side navigation, choose `Delete account`. The same menu is on `/trash` and the Settings pages.
- `Sign out` in the same menu posts `signOutRoutes.session` and goes to sign-in.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> delete-account`. Prints `"passed":true`.
- **Make data.** Import `clean.pptx` from Home. Poll `post(deckRoutes.original, { deck })` until it answers `ok: true`, and fetch its `url`: 200.
- **Ask.** On `/`, open the account menu, click `menuitem "Delete account"`. The dialog's `Delete account` button is disabled. Evidence `NN-delete-account-asks`.
- **Confirm.** Type the email into `Type your email to confirm`. The button enables. Evidence `NN-delete-account-typed`.
- **Delete.** Click it. The page asks for `https://airdesign.app/sign-in?next=%2F`, which the journey kit answers with its stand-in page. Evidence `NN-after-delete`.
- **Second views.** `post(deckRoutes.list, {}, cookie)` answers 401 `session`, the original's `url` answers 404, and `indexedDB.databases()` has no `airdesign`.
- **Sign up again.** Not in the journey, because the kit signs in a new email each time. `apps/api/src/delete-account.test.ts` signs the same email in again and lists no decks.

## Gotchas

- The confirmation ignores case and surrounding spaces, as sign-in does.
- The Account tab's own `Delete account` opens the dialog only once the email has loaded. Drive it with `page.locator("[data-settings-content]").getByRole("button", { name: "Delete account", exact: true })`; the look states `account-tab` and `account-delete-ask` reach it.
- On a Settings page the account button reads `Account` until the email loads. If the load fails, the email stays unknown.
- Stored originals whose upload link has not expired stay queued in `deck.original_delete` until it expires and the hourly drain runs; the file itself is deleted at once.
