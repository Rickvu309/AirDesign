# Deck list and Trash

Home (`Recents`, `/`) shows the signed-in person's six most recently edited decks from the server, newest edit first, as a grid or a list; `All decks` (`/all`) shows every deck in the same order. A deck can be moved to Trash and back. Trash shows when each deck was deleted and can be emptied for good.

## Sub-features

- `list-home` Recents lists the six newest server decks as `heading "<name>"` with their edit time; `link "All decks"` in the sidebar opens `/all` with every deck, and the sidebar marks the page you are on with `aria-current="page"`. Search, All decks and renaming are in `deck-names.md`.
- `list-view` `/?view=list` shows a table with `Name`, `Edited` and `Created` columns. Rows show no action buttons. Right-click anywhere in a row, or focus its deck link and press Shift+F10, to open Star or Remove star and Move to Trash. State `decks-list-menu`.
- `star` each deck card has `button "Star <name>"`; list rows offer `menuitem "Star <name>"` in their context menu. Once starred, the action reads `Remove star from <name>` and a status line says `Starred <name>` or `Removed star from <name>`. The sidebar's `navigation "Starred"` links each starred deck to `/deck/<id>` in Home's order, or says `Star a deck to keep it here.` The star paints at once and is kept on the device under the signed-in account until `deckRoutes.star` takes it; Home sends a held one again on load and on focus. Only the owner can star a deck, and deleting it for good clears the star. Journey `deck-stars`.
- `home-no-decks` with no decks, on a first visit or while Trash holds some, Home shows the `No decks yet` card with its own `Blank deck` and `Import PowerPoint`, beside the `New deck` menu's pair (the menu is `menu "New deck"` and its items are `menuitem`; scope to it, as `bin/new-deck.mjs` does). No sample deck is shown (PR 381). It never shows with the search's `No decks match` card. States `decks-empty`, `recents-empty`.
- `home-loading` and `home-failed` while the list loads, Home shows a skeleton (`[aria-busy=true][data-loading=true]`). A failed list shows the alert `Unable to load your decks` with `Try again`.
- `new-deck` `button "New deck"` opens `Blank deck` and `Import PowerPoint`. While a file imports, an `Importing` card shows; a refused file shows an alert card (see `open-edit-save.md`).
- `trash-move` `button "<name> actions"`, then `menuitem "Move to Trash"`, removes the deck from Home and shows `<name> moved to Trash` with `Undo`.
- `trash-undo` `Undo` brings the deck back.
- `trash-list` `/trash` says `Decks here are removed for good after 30 days.` and lists trashed decks with `Deleted <when>, <n> days left`. The server deletes trashed decks older than 30 days when the list loads. Trash has no empty-state text, and `Empty Trash` is disabled when it is empty.
- `trash-restore` `button "Restore"` moves the deck back to Home.
- `trash-empty` `button "Empty Trash"` asks `Delete 1 deck for good?` (`decks` for more than one), says `This can't be undone.`, and offers `Cancel`; `Delete for good` removes them from the server.
- `list-signed-out` signed out, Home's list call answers 401 and the page goes to the sign-in page with `next=<path and query>`.
- `home-queued-name` a deck name still queued on this device for the signed-in account shows on its card at once, and Home sends it (see `deck-names.md`).
- Not in the app today: a menu on deck cards, and renaming from Home. A name is typed only in the editor (its title, and the file name after an import); Home only sends a name already queued.
- `home-unopened` a deck imported or made blank and left before its editor opens shows on Home at once, under its file's name, and Home sends its first open, name and original; it leaves the device's queue once the server lists it (PR 439, `tests/browser/deck-rename.spec.ts`). State `home-after-import-back`.

## How to get to it (user POV)

- Open `/` after signing in.
- `Trash` in the side navigation, or `/trash`.
- The card's `<name> actions` menu item `Move to Trash`, or the `Move to Trash` button on a list row.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The person owns at least one deck. The journey imports `clean.pptx` to make one.

- **Grid motion.** `deck-grid-motion` drives pointer Trash and Undo against the real API, checks 220 ms neighbour transforms, the fading exit, return to the original slot, focus, and a second Trash and Undo during a paused shift. It also checks no motion on load, search, keyboard actions, list view or reduced motion, including the last card and its first return. Proven 2026-11-16.
- **Run it.** `$V journey <run> deck-list-trash`. Prints `"passed":true`.
- **Make a deck.** Import `clean.pptx` from Home. Poll `post(deckRoutes.list, {})` until the deck's name is `clean`, the file name without `.pptx`.
- **Listed.** Open `/`. `heading "clean"` is visible. Evidence `NN-home-lists-deck`.
- **Move to Trash.** Click `button "clean actions"`, then `menuitem "Move to Trash"`. The text `clean moved to Trash` appears. `deckRoutes.list` shows the deck under `trash`. Evidence `NN-moved-to-trash`, `NN-api-decks-list.json`.
- **Trash.** Open `/trash`. `heading "clean"` is visible. Evidence `NN-trash-lists-deck`.
- **Restore.** Click `button "Restore"`. The heading leaves Trash, `deckRoutes.list` lists the deck under `decks`, and Home shows it again. Evidence `NN-restored`.
- **Empty Trash.** Not in the journey. In a scratch journey: move to Trash, open `/trash`, click `Empty Trash`, then `Delete for good`. `deckRoutes.list` no longer has the deck anywhere and `deckRoutes.open` refuses it.
- **Signed out.** Not in the journey. The stack builds `apps/web` for production, so the signed-out redirect goes to `https://airdesign.app/sign-in?next=%2F`; the journey kit answers that address with a stand-in page, so assert the URL. `signed-out-deck` drives it from a deck address.
- **Home states.** `No decks yet` shows on a new account before any import and right after the journey's Move to Trash.

## Gotchas

- Each journey signs in a new account, so Home starts empty apart from the imported deck. With more than one deck, scope a card's buttons to the card of the deck you mean.
- A rename does not change a deck's edit time, so it does not move the deck up in Recents.
- Edit times read `Edited just now` only right after the edit. Assert names and server state, not times.
- The `Undo` toast disappears after a few seconds. Click it at once or skip `trash-undo`.
