# Keep typed text and paint from the device

What a person types survives a reload or a closed tab, even one that comes before the edit was written to the device or sent to the server. The device copy of a deck belongs to the account signed in on that browser: it paints before the server answers, and another account on the same browser sees none of it. A deck the server refuses closes.

## Sub-features

- `journal` each keystroke's text, each new box and each slide command is first written to `localStorage` under `airdesign:unsaved:<account>:<deck>` in the keystroke's own task, then to IndexedDB, and the journal entry is dropped once IndexedDB has it. Only the newest text and box per element is kept. On the next open the journal is replayed before the first paint, then sent to the server. Speaker notes and slides take the same path (`tests/browser/keep-typed-text.spec.ts`).
- `reload-at-once` text typed and reloaded at once shows after the reload, reaches `deckRoutes.open`, and the journal ends empty. Driven live on 2026-11-13: a typed title, the text of a new text box, speaker notes, a nudge, a rename and bold, each reloaded with no wait, and a new text box, a deleted element, a new slide, a deleted slide and a picture, each reloaded once the server had it, all showed after the reload, and a fresh device then read the same deck from the server.
- `tab-closed` text typed and the tab closed at once shows in a new tab and reaches the server.
- `lost-answer` when a commit lands and its answer is lost, the next page resends the batch with the same `once` key. The revision rises once. `commit-once` drives a text edit. `tests/browser/real-save.spec.ts` drops an **Add slide** answer and opens the same two-slide deck after two reloads.
- `device-paint` a deck this account opened before on this browser paints from the device copy while `deckRoutes.open` is still on its way, then applies the server's answer on top and sets `.thin-page[data-deck-ready]`.
- `device-account` the device copy, the journal, the queued names, the pictures and the Aira chats are kept under the account (`accountKey` in `packages/live`, read from the `airdesign.account` cookie the sign-in sets). Another account on the same browser sees no deck, name, picture or chat of the first, and a deck address of the first shows `Deck not found` with nothing painted; the first account finds all of it again after signing in again. Signing out from Settings and deleting the account drop the chats kept for a closing page (`airdesign:chats:<account>:<deck>`).
- `refused` when `deckRoutes.open` or `deckRoutes.watch` answers `owner`, `deleted` or `deck`, the editor drops the painted deck and shows `Deck not found` with `link "Go to your decks"` (`[data-deck-refused]`), with no editable text and no Export, and it stays closed through a reload. A `session` refusal goes to sign-in; any other refusal or a network failure keeps the deck open.

## How to get to it (user POV)

- Type in a text box, then reload, close the tab, or lose the network.
- Open a deck you opened before in this browser.
- Sign out and sign in as someone else on the same browser.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> typed-reload`. Prints `"passed":true`.
- **Reload at once.** Import `clean.pptx`, select the text, type `Kept` with no delay and reload in the same breath. The slide reads `Kept`, `deckRoutes.open` holds `Kept`, and no `airdesign:unsaved:` key is left. Evidence `NN-reloaded`.
- **Device paint.** Hold `deckRoutes.open` with `page.route` and reload: the slide reads `Kept` while the open is held, and `data-deck-ready` is set once it lands. Evidence `NN-device-paint`.
- **Tab closed.** Type `Closed` and close the page at once; a new page on the deck address reads `Closed` and so does the server. The kit's `capture` uses the first page, so the journey does this after its captures.
- **Refused.** On that new page, answer `deckRoutes.open` with `{ok:false, refusal:"deleted"}`: `[data-deck-refused]` shows and no `[contenteditable]` is left.
- **Two accounts.** `signed-out-deck` signs out from Home and from Settings and opens a deck address. A scratch journey with `kit.signIn(email)` drove the round trip in `deck-names.md`.
- **Lost answer.** Intercept batches with a slide row on `deckRoutes.commit`. Forward each request with `route.fetch()` and drop its answer with `route.abort()`. After `deckRoutes.open` shows the added slide, remove the intercept and reload twice. Each reload opens the two-slide deck. The server holds one added row.

## Gotchas

- A faked refusal closes the deck for good in that browser: a reload after `unroute` still shows `Deck not found`. Drive the refusal last, or in a fresh context.
- `.thin-page[data-deck-ready]` says the open finished, not that every edit was saved. Poll `deckRoutes.open`.
- `tests/browser/open-from-device.spec.ts` slows IndexedDB with `window.deviceDelay` to widen the window; the journey reloads with no wait instead.
