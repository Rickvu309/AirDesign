# Deck list and Trash

Home (`Recents`, `/`) shows the signed-in person's six most recently edited decks from the server, newest edit first, as a grid or a list; `All decks` (`/all`) shows every deck in the same order. Each card paints its first slide from the deck. A deck can be starred, moved to Trash and back. Trash shows when each deck was deleted and can be emptied for good.

## Sub-features

- `list-home` Recents lists the six newest server decks as `heading "<name>"` with their edit time and a `[data-deck-thumbnail]` of the first slide; a card links to `/s/<id>`. `link "All decks"` in the sidebar opens `/all` with every deck, and the sidebar marks the page you are on with `aria-current="page"`. Search, All decks and renaming are in `deck-names.md`.
- `list-view` `/?view=list` shows a table with `Name`, `Edited` and `Created` columns. Rows show no action buttons. Right-click anywhere in a row, or focus its deck link and press Shift+F10, to open Star or Remove star and Move to Trash. State `decks-list-menu`.
- `star` each deck card has `button "Star <name>"`; list rows offer `menuitem "Star <name>"` in their context menu. Once starred, the action reads `Remove star from <name>` and a status line says `Starred <name>` or `Removed star from <name>`. The sidebar's `navigation "Starred"` links each starred deck to `/s/<id>` in Home's order, or says `Star a deck to keep it here.` The star paints at once and is kept on the device under the signed-in account until `deckRoutes.star` takes it; Home sends a held one again on load and on focus (`packages/live/src/deck-star.test.ts`). States `decks-starred`, `decks-starred-list`.
- `home-no-decks` with no decks, on a first visit or while Trash holds some, Home shows the `No decks yet` card with its own `Blank deck` button. No sample deck is shown. It never shows with the search's `No decks match` card. States `decks-empty`, `recents-empty`.
- `home-loading` and `home-failed` while the list loads, Home shows a skeleton (`[aria-busy=true][data-loading=true]`). A failed list shows the alert `Unable to load your decks` with `Try again`. States `decks-loading`, `decks-list-loading`, `decks-failed`.
- `new-deck` `button "New deck"` opens a new deck at `/s/<id>` (see `open-edit-save.md`).
- `trash-move` `button "<name> actions"`, then `menuitem "Move to Trash"`, removes the deck from Home and shows `<name> moved to Trash` with `Undo`. The other cards slide into the gap unless the person prefers reduced motion (`apps/web/src/decks/grid-shift.ts`). States `trash-toast`, `trash-move-failed`.
- `trash-undo` `Undo` brings the deck back.
- `trash-list` `/trash` says `Decks here are removed for good after 30 days.` and lists trashed decks with `Deleted <when>, <n> days left`. The server deletes trashed decks older than 30 days when the list loads. Trash has no empty-state text, and `Empty Trash` is disabled when it is empty. State `trash-populated`.
- `trash-restore` `button "Restore"` moves the deck back to Home. State `trash-restore-failed`.
- `trash-empty` `button "Empty Trash"` asks `Delete 1 deck for good?` (`decks` for more than one), says `This can't be undone.`, and offers `Cancel`; `Delete for good` removes them from the server with their edits, and drops this device's copy.
- `list-signed-out` signed out, Home's list call answers 401 and the page goes to the sign-in page with `next=<path and query>`.

## How to get to it (user POV)

- Open `/` after signing in.
- `Trash` in the side navigation, or `/trash`.
- The card's `<name> actions` menu item `Move to Trash`, or a list row's context menu.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> deck-list-trash`. Prints `"passed":true`.
- **Make a deck.** From Home, `button "New deck"` opens `/s/<id>` (`newDoomDeck` in `../bin/new-deck.mjs`). Rename it in the editor's title to `Quarterly review` and poll `post(deckRoutes.list, {})` until it carries that name.
- **Make a second deck.** `New deck` again; poll `post(deckRoutes.list, {})` until it carries `doom`.
- **Listed.** Open `/`. `heading "Quarterly review"` is visible, and both cards paint a `[data-deck-thumbnail]`. Evidence `NN-home-lists-deck`.
- **Move to Trash.** Click `button "Quarterly review actions"`, then `menuitem "Move to Trash"`. The text `Quarterly review moved to Trash` appears. `deckRoutes.list` shows the deck under `trash`. Evidence `NN-moved-to-trash`, `NN-api-decks-list.json`.
- **Trash.** Open `/trash`. `heading "Quarterly review"` is visible. Evidence `NN-trash-lists-deck`.
- **Restore.** Click `button "Restore"`. The heading leaves Trash, `deckRoutes.list` lists the deck under `decks`, and Home shows it again. Evidence `NN-restored`.
- **Empty Trash.** Not in the journey. In a scratch journey: move to Trash, open `/trash`, click `Empty Trash`, then `Delete for good`. `deckRoutes.list` has the deck nowhere and `doomRoutes.open` refuses it. `apps/api/src/deck-list-doom.test.ts` holds the server side: the 30 days, delete for good, and another account's decks.
- **Specs.** `tests/browser/home.spec.ts` lists a new deck with its thumbnail, moves it to Trash and back; `tests/browser/toast-layout.spec.ts` holds the moved toast's Undo and Close on a phone.
- **Signed out.** Not in the journey. The stack builds `apps/web` for production, so the signed-out redirect goes to `https://airdesign.app/sign-in?next=%2F`; the journey kit answers that address with a stand-in page, so assert the URL.

## Gotchas

- Each journey signs in a new account, so Home starts empty apart from the decks it makes. With more than one deck, scope a card's buttons to the card of the deck you mean (`[data-deck="<id>"]`).
- Edit times read `Edited just now` only right after the edit. Assert names and server state, not times.
- The `Undo` toast disappears after a few seconds. Click it at once or skip `trash-undo`.
