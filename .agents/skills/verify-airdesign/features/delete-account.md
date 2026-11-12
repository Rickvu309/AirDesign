# Delete account

The account button on Home opens a menu with `Delete account`. It opens a dialog that names what goes (`Removes your decks and credits for good.`) and asks for the signed-in email. Once the email is typed, `Delete account` deletes the account on the server with every deck, stored original, session, agent connection and Aira usage it holds, removes the browser's copy of the decks, and goes to sign-in.

## Sub-features

- `delete-ask` the dialog's `button "Delete account"` stays disabled until the typed email matches the signed-in one. `Cancel` closes it and sends nothing.
- `delete-server` `accountRoutes.delete` with `{ email }` answers 200 and clears the session cookie the way sign-out does. Any other email answers 400 `field`.
- `delete-credentials` afterwards the old cookie answers 401 `session` everywhere, and the person's agent access and refresh tokens are refused.
- `delete-originals` the person's stored originals are deleted from the store; a download link issued before answers 404.
- `delete-device` the browser holds no `airdesign` IndexedDB database.
- `delete-again` the same email can sign in again and starts with no decks.

## How to get to it (user POV)

- Sign in, open `/`, click the account button with the email in the side navigation, choose `Delete account`.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> delete-account`. Prints `"passed":true`.
- **Make data.** Import `clean.pptx` from Home. Poll `post(deckRoutes.original, { deck })` until it answers `ok: true`, and fetch its `url`: 200.
- **Ask.** On `/`, open the account menu, click `menuitem "Delete account"`. The dialog's `Delete account` button is disabled. Evidence `NN-delete-account-asks`.
- **Confirm.** Type the email into `Signed in with email`. The button enables. Evidence `NN-delete-account-typed`.
- **Delete.** Click it. The page goes to `/sign-in?next=%2F`. Evidence `NN-after-delete`.
- **Second views.** `post(deckRoutes.list, {}, cookie)` answers 401 `session`, the original's `url` answers 404, and `indexedDB.databases()` has no `airdesign`.
- **Sign up again.** Not in the journey, because the kit signs in a new email each time. `apps/api/src/delete-account.test.ts` signs the same email in again and lists no decks.

## Gotchas

- The confirmation ignores case and surrounding spaces, as sign-in does.
- Stored originals whose upload link has not expired stay queued in `deck.original_delete` until it expires and the hourly drain runs; the file itself is deleted at once.
