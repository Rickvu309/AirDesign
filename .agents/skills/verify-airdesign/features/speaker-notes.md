# Speaker notes

Under the slide of an open deck, the speaker notes bar shows the current slide's notes. The person expands it and types; the notes save like any edit, offline included, and the export writes them to the slide's notes part, building the notes slide, and a notes master when the deck has none.

## Sub-features

- `notes-open` `button "Expand presenter notes"` opens `textbox "Speaker notes"` (placeholder `Add speaker notes`); `Collapse presenter notes` closes it. Notes start open in a compact card. Closed, only the handle is visible. A click or Enter on it opens the field with the cursor at the end of the notes; `Collapse presenter notes` gives the focus back to the closed bar. The notes are in body ink, the placeholder quiet.
- `notes-edit` typed notes paint at once and reach the server as the slide's `.notes` element, on any slide, including one whose PowerPoint has no notes part.
- `notes-undo` a visit's typing in the field is one `Undo speaker notes edit` step on the toolbar, and its undo repaints the bar. Inside the field Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z are the person's undo too (the field carries `data-person-undo`), and it refuses the browser's own undo from its menu.
- `notes-offline` typed offline, the editor says `You're offline. Edits are saved on this device.` and sends them when the browser is back online.
- `notes-reload` notes typed and reloaded at once are still there (the keystroke journal, see `keep-typed-text.md`).
- `notes-export` the export waits for notes still on their way, writes them, and a new import of that file shows them. A slide with no notes part gets a new notes slide; a deck with no notes master gets one.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the bar under the slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/nasa-1d-cnn.pptx` exists: slide 1 has a notes part, slide 2 has none.

- **Run it.** `$V journey <run> speaker-notes`. Prints `"passed":true`.
- **Open.** Import the fixture, click `Expand presenter notes`. The field is editable. Evidence `NN-notes-closed`, `NN-notes-open`.
- **Any slide.** Click `[data-slide-entry="2"]`, the slide with no notes part. The field is editable and empty.
- **Offline edit.** Back on slide 1, go offline, fill the field, see the offline toast, go online; poll `deckRoutes.open` for the `.notes` element's value.
- **Reload, export, import.** The notes come back each time. Evidence `NN-notes-reloaded`, `NN-notes-reimported`.
- **Notes in a range export.** Driven live on 2026-11-13 with a scratch journey: notes typed on slides 2 and 3 of a blank deck, the second just before Export, were both in a range 2 to 3 export and in its new import (see `export.md`).
- **States for look.** `notes-closed`, `notes-open`, `notes-typed` (typed at once after the click, so lost keystrokes show).

- **Recovery toast.** Driven live on 2026-11-17: notes beyond the 8,000-byte value limit show the real notes-edit error for more than 5.5 seconds; pointer Close dismisses it, a second refusal appears again, and keyboard Close dismisses it. Regression: `tests/browser/export-toast.spec.ts`.

## Gotchas

- The notes live on the slide's notes part, keyed `<slide part>.notes` in the server register.
