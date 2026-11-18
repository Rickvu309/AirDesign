# Deck names, search and All decks

A person finds a deck by typing part of its name in the sidebar's search box, sees every deck under `All decks`, and renames a deck from its title in the editor. The new name paints at once, is kept on the device until the server has it, names the browser tab and names the exported file. The editor's `Design` tab is shown but turned off until the Design panel exists.

## Sub-features

- `all-decks` `link "All decks"` in the sidebar opens `/all`, with `heading "All decks"` (level 1) over every deck, newest edit first. Recents (`/`) shows the six newest. The link of the page you are on has `aria-current="page"`.
- `search` `searchbox "Search"` in the sidebar's `search` form filters the decks of the page you are on by name as you type, ignoring case and accents, and keeps the query in the address as `?q=` (beside `view=list`), so a reload keeps it. Recents searches every deck, not only its six. No match shows `heading "No decks match “<query>”"`, `Check the spelling or search for another name.` and `button "Clear search"`. Escape in a box that holds text clears it. Trash is searched too. On a Settings page, Enter goes to `/?q=<query>`.
- `rename` in the editor, `button "Rename deck: <name>"` turns into `textbox "Deck name"` with the name selected. Enter saves and Escape cancels; both put focus back on the button. Leaving the field saves a valid name and drops an invalid one. Names are trimmed and 1 to 200 characters; Enter on an empty or a too long name keeps the field open with the alert `Enter a name for this deck.` or `Use 200 characters or fewer.` The new name shows at once, the tab reads `<name> - AirDesign`, and `deckRoutes.rename` stores it. A rename does not change the deck's edit time.
- `queued-name` a name is queued on the device under the signed-in account (`queueRename` in `packages/live`) and sent from there. When the request is cut off, for example by going Back at once (Back reloads the page), Home shows the queued name on the deck's card at once and sends it; a failed send stays queued and goes again on the next list. Another account on the same browser sees no queued name and sends none; the first account's Home sends it after that account signs in again.
- `import-name` an imported deck takes its file's name without `.pptx`, sent through the same queue, so a late import name never overwrites a newer rename.
- `export-name` `Export` opens the Export dialog; its `Export` saves `<name>.pptx` (characters a file name cannot hold become spaces, cut at 120; an empty name saves `Blank deck.pptx`), and the app shows no notice once the browser has the file. The dialog is in `export.md`.
- `design-tab` on a real deck `button "Design"` is on beside `Agent`. Its panel is in `slide-background.md`.

## How to get to it (user POV)

- The sidebar on Home, Trash and Settings: `Search`, `Recents`, `All decks`.
- An open deck: the deck's name at the top left of the editor, and `Export` at the top right.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> deck-names`. Prints `"passed":true`.
- **Two decks.** Import `clean.pptx` twice and wait until `deckRoutes.list` names both `clean`.
- **Rename.** In the second deck click `button "Rename deck: clean"`, type `Board pack`, Enter. The button reads `Rename deck: Board pack`, the tab `Board pack - AirDesign`, and `deckRoutes.list` names the deck `Board pack`. An empty name and Enter shows `Enter a name for this deck.`; Escape keeps `Board pack`. Evidence `NN-renamed`, `NN-rename-refused`.
- **Design and Export.** `button "Design"` is enabled. `Export`, then Enter in the dialog, saves `Board pack.pptx` and shows no notice. Evidence `NN-downloaded`.
- **All decks and search.** `/all` lists `Board pack` and `clean`, with `All decks` marked current. Typing `board` leaves only `Board pack` and puts `q=board` in the address; a reload keeps it; `nothing here` shows the no-match card; `Clear search` empties the box. Evidence `NN-all-decks`, `NN-search-match`, `NN-search-empty`.
- **Queued name across accounts.** Not in a shipped journey. Driven live on 2026-11-13 with a scratch journey: with `deckRoutes.rename` aborted, rename to `Alpha private` and go Home (the card shows it, the server keeps `clean`), sign out, sign in a second account (Home shows `No decks yet`, sends no rename, and the first deck's address shows `Deck not found` with no slide, picture or chat painted), sign out, sign the first account in again with `kit.signIn(email)`: Home sends `Alpha private` once and `deckRoutes.list` names it.
- **States for look.** `decks-all`, `decks-search-match`, `decks-search-empty`, `editor-renaming`, `editor-rename-refused`, and `home-after-rename-back` (a rename held 300 ms and dropped when the editor's page goes Back, then Home), each one file in `look/states/`, with the shared drivers `look/renaming.mjs` and `look/deck-listing.mjs`.

## Gotchas

- The editor has no Back control: the logo is hidden from screen readers and `Grid` is disabled. Use the browser's Back (`page.goBack()`).
- Wait for the server name with `expect.poll` on `deckRoutes.list`, never only for the button text.
- `context.unroute` needs the same function `context.route` got; a new arrow function removes nothing, and the abort stays.
