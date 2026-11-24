# Speaker notes

Under the slide of an open deck, the presenter notes bar shows the current slide's notes. The person types in it; the notes are written to the slide's `notes` when the person pauses or leaves the field, save like any edit, offline included, and show in the presenter view.

## Sub-features

- `notes-open` the bar starts open with `textbox "Presenter notes"` (placeholder `Add presenter notes`). Its handle, `button "Collapse presenter notes"` or `button "Expand presenter notes"`, closes and opens it; a drag on the handle sets its height, and Home, End, ArrowUp and ArrowDown on the handle do the same from the keyboard (`apps/web/src/editor/notes-bar.tsx`). States `notes-open`, `notes-closed`, `notes-dragged`.
- `notes-edit` typed notes show at once; 600 ms after the last key, or when the field loses focus or the slide changes, they are one write of the slide node's `notes` through `doomRoutes.edit` (`DoomNotes` in `apps/web/src/editor/doom-notes.tsx`, `notesWrites` in `deck-writes.ts`). Each slide has its own notes; a new slide's field is empty.
- `notes-reload` saved notes are there after a reload (`tests/browser/doom-editor-page.spec.ts`).
- `notes-present` the presenter view shows the current slide's notes (`p` during a show; see `slide-commands.md`).

## How to get to it (user POV)

- An open deck `/s/<id>`: the bar under the slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Spec.** `tests/browser/doom-editor-page.spec.ts` fills the notes, polls the saved slide's `notes.chars`, adds a slide whose notes are empty, goes back and finds the notes, and reloads.
- **In a scratch journey.** Make a deck with `newDoomDeck`, fill `textbox "Presenter notes"`, click the slide list, and poll `post(doomRoutes.open, { deck }, cookie)` until the slide node's `notes.chars` is the typed text. Reload; the field holds it.
- **States for look.** `notes-closed`, `notes-open`, `notes-typed` (typed with no delay, so lost keystrokes show), `notes-dragged`, `notes-then-text-undone` (notes typed while their edit is held, then a text edit undone).

## Gotchas

- The notes live on the slide node as a text value, `notes.chars`, in the server's fold.
- The field is `[data-notes-bar] textarea`; scope to it, since the slide's own text is `[contenteditable]`.
