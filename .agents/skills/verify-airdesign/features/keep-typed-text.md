# Keep typed text and paint from the device

What a person types survives a reload or a closed tab, even one that comes before the edit was written to the device or sent to the server. A deck this browser opened before paints from the device's copy before the server answers, and a deck the server refuses closes.

## Sub-features

- `journal` each keystroke's text, each new box and each slide command is first written to `localStorage` under `airdesign:unsaved:<deck>` in the keystroke's own task, then to IndexedDB, and the journal entry is dropped once IndexedDB has it. Only the newest text and box per element is kept. On the next open the journal is replayed before the first paint, then sent to the server. Speaker notes and slides take the same path (`tests/browser/keep-typed-text.spec.ts`).
- `reload-at-once` text typed and reloaded at once shows after the reload, reaches `deckRoutes.open`, and the journal ends empty.
- `tab-closed` text typed and the tab closed at once shows in a new tab and reaches the server.
- `device-paint` once the server has opened a deck in this browser, the device copy is trusted: the next open paints it and sets `.thin-page[data-deck-ready]` while `deckRoutes.open` is still on its way, then applies the server's answer on top. Signing out from Home stops trusting the device copy.
- `refused` when `deckRoutes.open` or `deckRoutes.watch` answers `owner`, `deleted` or `deck`, the editor drops the painted deck and shows `Unable to open this deck` with `Go to your decks` (`[data-deck-refused]`), with no editable text and no Export, and it stays closed through a reload. A `session` refusal goes to sign-in; any other refusal or a network failure keeps the deck open.

## How to get to it (user POV)

- Type in a text box, then reload, close the tab, or lose the network.
- Open a deck you opened before in this browser.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> typed-reload`. Prints `"passed":true`.
- **Reload at once.** Import `clean.pptx`, select the text, type `Kept` with no delay and reload in the same breath. The slide reads `Kept`, `deckRoutes.open` holds `Kept`, and no `airdesign:unsaved:` key is left. Evidence `NN-reloaded`.
- **Device paint.** Hold `deckRoutes.open` with `page.route` and reload: `data-deck-ready` is set and the slide reads `Kept` while the open is held. Evidence `NN-device-paint`.
- **Tab closed.** Type `Closed` and close the page at once; a new page on the deck address reads `Closed` and so does the server. The kit's `capture` uses the first page, so the journey does this after its captures.
- **Refused.** On that new page, answer `deckRoutes.open` with `{ok:false, refusal:"deleted"}`: `[data-deck-refused]` shows and no `[contenteditable]` is left.

## Gotchas

- A faked refusal closes the deck for good in that browser: a reload after `unroute` still shows `Unable to open this deck`. Drive the refusal last, or in a fresh context.
- `.thin-page[data-deck-ready]` is set by the device paint as well as the server open, so it is no proof of a save. Poll `deckRoutes.open`.
- `tests/browser/open-from-device.spec.ts` slows IndexedDB with `window.deviceDelay` to widen the window; the journey reloads with no wait instead.
