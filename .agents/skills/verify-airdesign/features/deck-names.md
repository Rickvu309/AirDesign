# Deck names, search and All decks

A person finds a deck by typing part of its name in the sidebar's search box, sees every deck under `All decks`, and renames a deck from its title in the editor. The new name paints at once, names the browser tab, reaches the server as a write to the deck's `name`, and shows on the deck's card at Home.

## Sub-features

- `all-decks` `link "All decks"` in the sidebar opens `/all`, with `heading "All decks"` (level 1) over every deck, newest edit first. Recents (`/`) shows the six newest. The link of the page you are on has `aria-current="page"`.
- `search` `searchbox "Search"` in the sidebar's `search` form filters the decks of the page you are on by name as you type, ignoring case and accents, and keeps the query in the address as `?q=` (beside `view=list`), so a reload keeps it. Recents searches every deck, not only its six. No match shows `heading "No decks match “<query>”"`, `Check the spelling or search for another name.` and `button "Clear search"`. Escape in a box that holds text clears it. Trash is searched too. On a Settings page, Enter goes to `/?q=<query>`.
- `rename` in the editor's sidebar, `button "Rename deck: <name>"` turns into `textbox "Deck name"` with the name selected; the chevron beside it (`button "<name> actions"`) offers `Rename` too. Enter saves and Escape cancels; both put focus back on the button. Leaving the field saves a valid name and drops an invalid one. Names are trimmed and 1 to 200 characters; Enter on an empty or a too long name keeps the field open with the alert `Enter a name for this deck.` or `Use 200 characters or fewer.` (`apps/web/src/editor/deck-title-edit.tsx`). The new name shows at once, the tab reads `<name> - AirDesign`, and the deck node's `name` reaches the server through `doomRoutes.edit` (`renameWrites` in `apps/web/src/editor/deck-writes.ts`); `deckRoutes.list` then names the deck.
- `name-from-title` a deck still named `Blank deck` takes its name from slide 1's title as the person types it, until the person renames it (see `open-edit-save.md`).
- `design-tab` `button "Design"` is on beside `Agent`. Its panel is in `design-panel.md`; with nothing selected it shows the slide (`slide-background.md`).

## How to get to it (user POV)

- The sidebar on Home, Trash and Settings: `Search`, `Recents`, `All decks`.
- An open deck: the deck's name at the top of the slide list.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Rename in a journey.** `$V journey <run> deck-list-trash` renames a new deck in the editor to `Quarterly review` and polls `deckRoutes.list` until it carries that name.
- **Rename in a spec.** `tests/browser/doom-editor-page.spec.ts` renames the deck in the sidebar, checks the tab title and the saved deck node, reloads, and finds the name on the Home card.
- **Refused name.** In a scratch journey: click `button "Rename deck: Blank deck"`, empty the field and press Enter. The alert reads `Enter a name for this deck.`; Escape keeps `Blank deck`.
- **All decks and search.** In a scratch journey with two decks: `/all` lists both, with `All decks` marked current. Typing part of one name leaves only that deck and puts `q=` in the address; a reload keeps it; a name no deck has shows the no-match card; `Clear search` empties the box.
- **States for look.** `decks-all`, `decks-search-match`, `decks-search-empty`, `decks-search-focus`, `editor-renaming`, `editor-rename-refused`, `deck-title-rename`, `deck-title-menu`, and `home-after-rename-back` (a rename held 300 ms, the edit dropped once the page goes Back, then Home), each one file in `look/states/`, with the shared drivers `../look/renaming.mjs` and `../look/deck-listing.mjs`.

## Gotchas

- The editor's way back to Home is `link "Go to your decks"`; `Grid` is disabled. The browser's Back (`page.goBack()`) reloads the page.
- Wait for the server name with `expect.poll` on `deckRoutes.list`, never only for the button text.
- `context.unroute` needs the same function `context.route` got; a new arrow function removes nothing, and the abort stays.
