# Keep edits on the device and paint from it

Every edit a person makes is first applied on the device and queued there, then sent to the server. A reload, a closed tab or a lost network keeps the queued edits, and they are sent once the deck is open and online again. The device copy of a deck belongs to the account signed in on that browser: it paints before the server answers, and another account on the same browser sees none of it. A browser that holds no copy, a cleared one or a new device, opens the server's copy.

## Sub-features

- `queue` each edit is applied to the view at once and kept with the server's last fold in IndexedDB (`deviceStorage` in `packages/live/src/doom-storage.ts`, keys `<deck>\u0004queue`, and `<deck>\u0004head`, `<deck>\u0004node` and `<deck>\u0004once` in `packages/live/src/fold-rows.ts`). A landed edit rewrites only the nodes it changed. Edits land in order, each on the one before it; offline they keep painting and queueing, and replay in order on reconnect (`packages/live/src/doom-deck.test.ts`).
- `lost-answer` an edit whose answer was lost lands once: it is sent again with the same `once`, and the server does not apply it twice.
- `device-paint` a deck this account opened before on this browser opens from the kept fold and queue without waiting for `doomRoutes.open`, then catches up with `doomRoutes.since` (`openDoomDeck` in `packages/live/src/doom-deck.ts`). `[data-editor-ready]` marks the open editor.
- `device-account` the kept decks, queued edits, stars, pictures and Aira chats are kept under the account (`accountKey` in `packages/live/src/device.ts`, read from the `airdesign.account` cookie the sign-in sets). Another account on the same browser sees none of the first one's; signed out, the device shows and keeps nothing (`packages/live/src/device-account.test.ts`).
- `fresh-device` a browser with no copy of the deck opens it from `doomRoutes.open`: the saved edits and pictures show (`tests/browser/editor-picture.spec.ts` opens a dropped picture on a fresh device).
- `refused` when the server does not know the deck and this browser holds no copy, the editor shows `Deck not found` with `link "Go to your decks"`. Signed out, it goes to sign-in with `next` set to the deck address (`sign-in.md`).

## How to get to it (user POV)

- Edit a deck, then reload, close the tab, or lose the network.
- Open a deck you opened before in this browser, or open it in another browser.
- Sign out and sign in as someone else on the same browser.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Unit tests.** `pnpm exec vitest run packages/live/src/doom-deck.test.ts packages/live/src/device-account.test.ts` holds the queue, the replay, a lost answer, the reload offline and the account scoping.
- **Reload.** `tests/browser/editor.spec.ts` moves and deletes a layer and finds the moves after a reload; `tests/browser/editor-text.spec.ts` keeps typed text through a reload.
- **Offline.** `tests/browser/editor-picture.spec.ts` lands a dropped picture in the deck while its upload fails and sends it once the device is back online.
- **In a scratch journey.** Make a deck with `newDoomDeck`, type in its title, reload with no wait, and poll `post(doomRoutes.open, { deck }, cookie)` for the text. For a fresh device, open the deck address in a new `browser.newContext()` signed in with the same cookie.
- **States for look.** `text-typed-at-once`, `text-placed-while-storing`, `deck-gone`.

## Gotchas

- `[data-editor-ready]` says the editor opened, not that every edit was saved. Poll `doomRoutes.open`.
- A deck opened from the device copy opens even when the server would refuse it; drive a refusal in a fresh context.
