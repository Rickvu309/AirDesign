# Keep typed text and paint from the device

What a person types survives a reload or a closed tab, even one that comes before the edit was written to the device or sent to the server. The device copy of a deck belongs to the account signed in on that browser: it paints before the server answers, and another account on the same browser sees none of it. A deck the server refuses closes.

## Sub-features

- `journal` each keystroke's text, each new box and each slide command is first written to `localStorage` under `airdesign:unsaved:<account>:<deck>` in the keystroke's own task, then to IndexedDB, and the journal entry is dropped once IndexedDB has it. Only the newest text and box per element is kept. On the next open the journal is replayed before the first paint, then sent to the server. Speaker notes and slides take the same path (`tests/browser/keep-typed-text.spec.ts`). Known failure: text typed in a table cell and reloaded at once comes back with only its first letter (`C` for `Cell`, three times out of three), while a text box typed and reloaded the same way keeps all of it; pinned in `tests/browser/keep-typed-text.spec.ts`.
- `reload-at-once` text typed and reloaded at once shows after the reload, reaches `deckRoutes.open`, and the journal ends empty. Driven live on 2026-11-13: a typed title, the text of a new text box, an added table row, speaker notes, a nudge, a rename and bold, each reloaded with no wait, and a new text box, a deleted element, an inserted table, a new slide, a deleted slide and a picture, each reloaded once the server had it, all showed after the reload, and a fresh device then read the same deck from the server.
- `tab-closed` text typed and the tab closed at once shows in a new tab and reaches the server.
- `lost-answer` when the server stores an edit but its answer is lost, the next page sends it again with the same `once` key and the revision rises once (`commit-once` journey, for text). Known failure for a slide command (`Add slide`, `Add text box`, an inserted table): the first reload paints with the error `person edit refused`, and every reload after it leaves the editor blank, with no slide, no name and no slide list, on that browser for good. The device then holds a confirmed row and a pending row for the same command (`withSlides` in `packages/live/src/slide-replay.ts` throws on the second). The server's copy is whole and a fresh device opens it. Pinned in `tests/browser/real-save.spec.ts`.
- `device-paint` a deck this account opened before on this browser paints from the device copy and sets `.thin-page[data-deck-ready]` while `deckRoutes.open` is still on its way, then applies the server's answer on top.
- `device-account` the device copy, the journal, the queued names, the pictures and the Aira chats are kept under the account (`accountKey` in `packages/live`, read from the `airdesign.account` cookie the sign-in sets). Another account on the same browser sees no deck, name, picture or chat of the first, and a deck address of the first shows `Unable to open this deck` with nothing painted; the first account finds all of it again after signing in again. Signing out from Settings and deleting the account drop the chats kept for a closing page (`airdesign:chats:<account>:<deck>`).
- `refused` when `deckRoutes.open` or `deckRoutes.watch` answers `owner`, `deleted` or `deck`, the editor drops the painted deck and shows `Unable to open this deck` with `Go to your decks` (`[data-deck-refused]`), with no editable text and no Export, and it stays closed through a reload. A `session` refusal goes to sign-in; any other refusal or a network failure keeps the deck open.

## How to get to it (user POV)

- Type in a text box, then reload, close the tab, or lose the network.
- Open a deck you opened before in this browser.
- Sign out and sign in as someone else on the same browser.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> typed-reload`. Prints `"passed":true`.
- **Reload at once.** Import `clean.pptx`, select the text, type `Kept` with no delay and reload in the same breath. The slide reads `Kept`, `deckRoutes.open` holds `Kept`, and no `airdesign:unsaved:` key is left. Evidence `NN-reloaded`.
- **Device paint.** Hold `deckRoutes.open` with `page.route` and reload: `data-deck-ready` is set and the slide reads `Kept` while the open is held. Evidence `NN-device-paint`.
- **Tab closed.** Type `Closed` and close the page at once; a new page on the deck address reads `Closed` and so does the server. The kit's `capture` uses the first page, so the journey does this after its captures.
- **Refused.** On that new page, answer `deckRoutes.open` with `{ok:false, refusal:"deleted"}`: `[data-deck-refused]` shows and no `[contenteditable]` is left.
- **Two accounts.** `signed-out-deck` signs out from Home and from Settings and opens a deck address. A scratch journey with `kit.signIn(email)` drove the round trip in `deck-names.md`.
- **Lost answer.** Route `deckRoutes.commit` so each batch holding a slide row reaches the server (`route.fetch()`) and the browser gets `route.abort()`, wait until `deckRoutes.open` shows the row, `unroute` with the same function, then reload twice and read `data-deck-ready`. While the route stays, the server lands a re-send once by its `once` key; if the route lets a re-send through before the reload, the page heals and nothing shows.

## Gotchas

- A faked refusal closes the deck for good in that browser: a reload after `unroute` still shows `Unable to open this deck`. Drive the refusal last, or in a fresh context.
- `.thin-page[data-deck-ready]` is set by the device paint as well as the server open, so it is no proof of a save. Poll `deckRoutes.open`.
- `tests/browser/open-from-device.spec.ts` slows IndexedDB with `window.deviceDelay` to widen the window; the journey reloads with no wait instead.
- A blank editor after a reload, with `person edit refused` in the page's errors, is the lost-answer failure above; listen with `page.on("pageerror")`.
