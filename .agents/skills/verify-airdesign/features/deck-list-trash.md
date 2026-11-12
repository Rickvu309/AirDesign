# Deck list and Trash

Home (`Recents`, `/`) shows the signed-in person's six most recently edited decks from the server, newest edit first, as a grid or a list; `All decks` (`/all`) shows every deck in the same order. A deck can be moved to Trash and back. Trash shows when each deck was deleted and can be emptied for good.

## Sub-features

- `list-home` Recents lists the six newest server decks as `heading "<name>"` with their edit time; `link "All decks"` in the sidebar opens `/all` with every deck, and the sidebar marks the page you are on with `aria-current="page"`. Search, All decks and renaming are in `deck-names.md`.
- `list-view` `/?view=list` shows a table with `Name`, `Edited` and `Created` columns. In a row, `Move to Trash` sits inside the name's `h2`, so `heading "clean", exact` does not match there.
- `home-first-visit` with no decks and nothing in Trash, Recents shows two sample cards, `Scratchpad` and `Welcome to AirDesign`. They are not links.
- `home-no-decks` with no decks while Trash holds some, Home shows `No decks yet` with `Blank deck` and `Import PowerPoint`.
- `home-loading` and `home-failed` while the list loads, Home shows a skeleton (`[aria-busy=true][data-loading=true]`). A failed list shows the alert `Unable to load your decks` with `Try again`.
- `new-deck` `button "New deck"` opens `Blank deck` and `Import PowerPoint`. While a file imports, an `Importing` card shows; a refused file shows an alert card (see `open-edit-save.md`).
- `trash-move` `button "Move to Trash"` removes the deck from Home and shows `<name> moved to Trash` with `Undo`.
- `trash-undo` `Undo` brings the deck back.
- `trash-list` `/trash` says `Decks here are removed for good after 30 days.` and lists trashed decks with `Deleted <when>, <n> days left`. The server deletes trashed decks older than 30 days when the list loads. Trash has no empty-state text, and `Empty Trash` is disabled when it is empty.
- `trash-restore` `button "Restore"` moves the deck back to Home.
- `trash-empty` `button "Empty Trash"` asks `Delete 1 deck for good?` (`decks` for more than one), says `This can't be undone.`, and offers `Cancel`; `Delete for good` removes them from the server.
- `list-signed-out` signed out, Home's list call answers 401 and the page goes to the sign-in page with `next=<path and query>`.
- Not in the app today: a menu on deck cards, and renaming from Home. `deckRoutes.rename` is called only by the editor (its title, and the file name after an import).

## How to get to it (user POV)

- Open `/` after signing in.
- `Trash` in the side navigation, or `/trash`.
- The `Move to Trash` button on a deck card or list row.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The person owns at least one deck. The journey imports `clean.pptx` to make one.

- **Run it.** `$V journey <run> deck-list-trash`. Prints `"passed":true`.
- **Make a deck.** Import `clean.pptx` from Home. Poll `post(deckRoutes.list, {})` until the deck's name is `clean`, the file name without `.pptx`.
- **Listed.** Open `/`. `heading "clean"` is visible. Evidence `NN-home-lists-deck`.
- **Move to Trash.** Click `button "Move to Trash"`. The text `clean moved to Trash` appears. `deckRoutes.list` shows the deck under `trash`. Evidence `NN-moved-to-trash`, `NN-api-decks-list.json`.
- **Trash.** Open `/trash`. `heading "clean"` is visible. Evidence `NN-trash-lists-deck`.
- **Restore.** Click `button "Restore"`. The heading leaves Trash, `deckRoutes.list` lists the deck under `decks`, and Home shows it again. Evidence `NN-restored`.
- **Empty Trash.** Not in the journey. In a scratch journey: move to Trash, open `/trash`, click `Empty Trash`, then `Delete for good`. `deckRoutes.list` no longer has the deck anywhere and `deckRoutes.open` refuses it.
- **Signed out.** Not in the journey. The stack builds `apps/web` for production, so the signed-out redirect goes to `https://airdesign.app/sign-in?next=%2F`; the journey kit answers that address with a stand-in page, so assert the URL. `signed-out-deck` drives it from a deck address.
- **Home states.** `No decks yet` shows right after the journey's Move to Trash. The first-visit cards show on a new account before any import.

## Gotchas

- Each journey signs in a new account, so Home starts empty apart from the imported deck. With more than one deck, `button "Move to Trash"` matches one per card; scope it to the card of the deck you mean.
- A rename does not change a deck's edit time, so it does not move the deck up in Recents.
- Edit times read `Edited just now` only right after the edit. Assert names and server state, not times.
- The `Undo` toast disappears after a few seconds. Click it at once or skip `trash-undo`.
