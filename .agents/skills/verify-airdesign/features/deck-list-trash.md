# Deck list and Trash

Home shows the signed-in person's decks from the server, newest edit first, as a grid or a list. A deck can be moved to Trash and back. Trash shows when each deck was deleted and can be emptied for good.

## Sub-features

- `list-home` Home lists each server deck as `heading "<name>"` with its edit time.
- `list-view` `/?view=list` shows the table with `Name` and `Created` columns.
- `trash-move` `button "Move to Trash"` removes the deck from Home and shows `<name> moved to Trash` with `Undo`.
- `trash-undo` `Undo` brings the deck back.
- `trash-list` `/trash` lists trashed decks with `Deleted <when>, <n> days left`.
- `trash-restore` `button "Restore"` moves the deck back to Home.
- `trash-empty` `button "Empty Trash"` asks `Delete <n> deck for good?`; `Delete for good` removes it from the server.
- `list-signed-out` signed out, Home goes to `/sign-in?next=<path and query>`.

## How to get to it (user POV)

- Open `/` after signing in.
- `Trash` in the side navigation, or `/trash`.
- The `Move to Trash` button on a deck card or list row.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- The person owns at least one deck. The journey imports `clean.pptx` to make one.

- **Run it.** `$V journey <run> deck-list-trash`. Prints `"passed":true`.
- **Make a deck.** Import `clean.pptx` from Home. Poll `post(deckRoutes.list, {})` until the deck's name is `clean.pptx`.
- **Listed.** Open `/`. `heading "clean.pptx"` is visible. Evidence `NN-home-lists-deck`.
- **Move to Trash.** Click `button "Move to Trash"`. The text `clean.pptx moved to Trash` appears. `deckRoutes.list` shows the deck under `trash`. Evidence `NN-moved-to-trash`, `NN-api-decks-list.json`.
- **Trash.** Open `/trash`. `heading "clean.pptx"` is visible. Evidence `NN-trash-lists-deck`.
- **Restore.** Click `button "Restore"`. The heading leaves Trash, `deckRoutes.list` lists the deck under `decks`, and Home shows it again. Evidence `NN-restored`.
- **Empty Trash.** Not in the journey. In a scratch journey: move to Trash, open `/trash`, click `Empty Trash`, then `Delete for good`. `deckRoutes.list` no longer has the deck anywhere and `deckRoutes.open` refuses it.
- **Signed out.** Not in the journey. Open `/` without `signIn()`. The page goes to `/sign-in?next=%2F`, which this stack does not serve (see `sign-in.md`).

## Gotchas

- Each journey signs in a new account, so Home starts empty apart from the imported deck. With more than one deck, `button "Move to Trash"` matches one per card; scope it to the card of the deck you mean.
- Edit times read `Edited just now` only right after the edit. Assert names and server state, not times.
- The `Undo` toast disappears after a few seconds. Click it at once or skip `trash-undo`.
