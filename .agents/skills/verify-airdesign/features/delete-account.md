# Delete account

The account button at the top of the side navigation (on Home, Trash and every Settings page) opens a menu with `Usage`, `Agents`, `Account`, `Delete account` and `Sign out`, and the `Account` tab in Settings (`/settings/account`) shows the signed-in email with `Sign out` and `Delete account` buttons. Either opens the dialog `Delete your account?`, which names what goes (`Your decks, Trash and connected agents are deleted for good. This can't be undone.`) and asks for the signed-in email. Once the email is typed, `Delete account` deletes the account on the server with every deck, stored picture, session, agent connection and Aira usage it holds, removes the browser's copy of the decks, and goes to sign-in with `next` set to the page it was on.

## Sub-features

- `delete-ask` the dialog `Delete your account?` has `button "Delete account"`, which stays disabled until the typed email matches the signed-in one. `Cancel` closes it and sends nothing. While the signed-in email has not loaded (a page whose own load failed), it stays disabled whatever is typed.
- `delete-failed` when the server refuses the delete or cannot be reached, the dialog stays open with the alert `Unable to delete your account. Check your connection and try again.` and `Delete account` can be pressed again; a 401 goes to sign-in. `tests/browser/account.spec.ts` covers both.
- `delete-server` `accountRoutes.delete` with `{ email }` answers 200 and clears the session and account cookies the way sign-out does. Any other email answers 400 `field`.
- `delete-credentials` afterwards the old cookie answers 401 `session` everywhere, and the person's agent access and refresh tokens are refused.
- `delete-files` the person's stored pictures are deleted from the store.
- `delete-device` the browser holds none of the account's device copies (`dropAccount` in `packages/live/src/device-sweep.ts`).
- `delete-again` the same email can sign in again and starts with no decks.

## How to get to it (user POV)

- Sign in, open `/`, click the account button with the email in the side navigation, choose `Delete account`. The same menu is on `/trash` and the Settings pages.
- `Sign out` in the same menu posts `signOutRoutes.session` and goes to sign-in.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Server.** `apps/api/src/delete-account.test.ts` fills an account with decks, a picture, an agent connection and an Aira turn, deletes it, checks every account table is empty (`accountTables` in `apps/api/src/testing/filled-account.ts`), the store holds none of its files, the cookie and agent tokens are refused, another account is untouched, and the same email signs in again to no decks.
- **Browser.** `tests/browser/account.spec.ts` reaches Account from the account menu and the Settings tabs and walks the delete confirmation, the disabled button while the email is unknown, and a refused delete.
- **In a scratch journey.** Make a deck with `newDoomDeck`. On `/`, open the account menu, click `menuitem "Delete account"`; the dialog's `Delete account` is disabled. Type the email into `Type your email to confirm`; it enables. Click it: the page asks for `https://airdesign.app/sign-in?next=%2F`, which the journey kit answers with its stand-in page. Then `post(deckRoutes.list, {}, cookie)` answers 401 `session`.
- **States for look.** `account-tab`, `account-delete-ask`, `account-delete-focus`.

## Gotchas

- The confirmation ignores case and surrounding spaces, as sign-in does.
- The Account tab's own `Delete account` opens the dialog only once the email has loaded. Drive it with `page.locator("[data-settings-content]").getByRole("button", { name: "Delete account", exact: true })`; the look states `account-tab` and `account-delete-ask` reach it.
- On a Settings page the account button reads `Account` until the email loads. If the load fails, the email stays unknown.
- A stored picture whose upload link has not expired stays queued in `deck.original_delete` until it expires and the drain runs; the file itself is deleted at once.
