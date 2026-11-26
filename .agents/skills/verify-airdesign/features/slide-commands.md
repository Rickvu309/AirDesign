# Add, duplicate, move and delete slides

The slide list on the left of an open deck lists every slide. The person adds a slide with the `Add slide` button or a starting slide from the `New slide` menu, and, on a focused slide entry, adds one after it with Enter, duplicates it with Ctrl/Cmd+D, moves it with Ctrl/Cmd+[ or Ctrl/Cmd+] (or by dragging), and deletes it with Delete or Backspace. Each change paints at once, is one undo step, reaches the server as writes to the slide nodes, and survives a reload. `Present` shows the deck full screen.

## Sub-features

- `slide-add` `button "Add slide"` adds a slide with a title after the current one and opens it; Enter on a focused entry adds one after that entry. The status line says `Added slide <n>` (`useSlideStrip` in `apps/web/src/editor/use-slide-strip.tsx`).
- `slide-start` `button "Choose a layout for the new slide"` beside `New slide` lists the designed starting slides: `Title`, `Title and text`, `Grid` and `Blank`. Choosing one adds that slide after the current one (`tests/browser/editor-page.spec.ts`). States `new-slide-menu`, `new-slide-layout`, `slide-added-title`.
- `slide-duplicate` Ctrl/Cmd+D on a focused `[data-slide-entry]` adds a copy after it and makes the copy current.
- `slide-move` Ctrl/Cmd+[ or Ctrl/Cmd+] on a focused entry moves that slide one place, and the moved slide stays current. Dragging an entry onto another moves it there (`tests/browser/editor-slides-transform.spec.ts`). State `slide-moved-twice`.
- `slide-delete` Delete or Backspace on a focused entry deletes that slide. The last slide cannot be deleted: the status line says `A deck keeps at least one slide.`
- `slide-menu` a right-click on an entry, the Menu key or Shift+F10 opens the slide menu with `Duplicate`, `Delete`, `Move up` and `Move down` and their keys; Escape closes it. States `slide-actions-menu`, `slide-deleted`.
- `slide-skip` the same menu has `Skip slide` (or `Unskip slide` when the entry is already skipped). Choosing it writes the slide's `skipped` prop, one undo step, dims the thumbnail, lays a closed eye on it, and shows a dash where its number was; the slides after it keep their deck numbers. Present and an export of all slides or a range leave that slide out; exporting the current slide keeps it. State `slide-skipped`.
- `slide-step` ArrowUp, ArrowDown, PageUp and PageDown on a focused entry step through the slides.
- `slide-undo` each change is one step of the person's undo: Ctrl/Cmd+Z takes back an add, a duplicate, a move or a delete. See `person-undo.md`.
- `slide-saved` the server's fold holds each slide as a `slide` node; a deleted slide's `parent` is `null`, and the order follows the slides' order keys.
- `present` `button "Present"` at the top right, F5 (from the first slide), Shift+F5 or Ctrl/Cmd+Enter (from the current slide) start the show; the show keys step through it, `p` switches to the presenter view with the notes, the next slide and the time, and Escape returns to the editor on the slide the show stopped on (`tests/browser/editor-presenting.spec.ts`). States `present-show`, `present-slide`, `present-controls`, `present-end`, `present-go-to`, `presenter`, `presenter-view`, `presenter-last`.

## How to get to it (user POV)

- An open deck `/s/<id>`: the `+` button (`Add slide`) and the `New slide` chevron at the top of the slide list.
- Click a slide in the list, then the keys.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Specs.** `pnpm test:browser tests/browser/editor-slides.spec.ts tests/browser/editor-slides-transform.spec.ts tests/browser/editor-presenting.spec.ts`: add, step, drag, move, duplicate, delete, undo and reload, each read from the server's fold with `savedSlides`; the last slide kept; the slide menu from the keyboard; the show and the presenter view.
- **In a scratch journey.** Make a deck with `newDoomDeck`, click `Add slide` twice, click entry 1, press Ctrl+], then poll `post(doomRoutes.open, { deck }, cookie)` until the slide order in `json.fold` has the first slide second. Reload; the list shows three entries in that order.
- **Reload.** `tests/browser/editor-slide-address.spec.ts`: the address carries `node-id`, a reload opens that slide, a gone slide opens slide 1, and moving between slides adds no history entry.
- **Scratch journey, 2026-11-24.** From Home, New deck, then Add slide. Skip slide on entry 2 writes `skipped`, dims that thumbnail, lays a closed eye on it and swaps its number for a dash, and entry 3 still reads 3. One undo clears it. The server fold agrees.
- **States for look.** `slides-several`, `slides-reloaded`, `slide-list-set`, `slide-skipped`, plus the states named above.

## Gotchas

- Focus stays on the current slide's entry after a slide command, so two Ctrl+] presses in a row move the same slide twice.
- An entry's text is its thumbnail's text plus its number, so `toContainText` works and `toHaveText` does not.
- Enter adds a slide only while an entry has focus; on the canvas it edits the selected layer.
