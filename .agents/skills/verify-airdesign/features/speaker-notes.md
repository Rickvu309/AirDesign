# Speaker notes

Under the slide of an open deck, the speaker notes bar shows the current slide's notes. The person expands it and types; the notes save like any edit, offline included, and the export writes them to the slide's notes part. A slide whose PowerPoint has no notes part shows its notes as not editable yet.

## Sub-features

- `notes-open` `button "Expand speaker notes"` opens `textbox "Speaker notes"` (placeholder `Add speaker notes`); `Collapse speaker notes` closes it. Closed, the bar shows the notes' first line or `Add speaker notes`.
- `notes-edit` typed notes paint at once and reach the server as the slide's `.notes` element.
- `notes-locked` on a slide with no notes part the field is not editable and the bar says `Speaker notes can't be edited on this slide yet.`
- `notes-offline` typed offline, the editor says `You're offline. Edits are saved on this device.` and sends them when the browser is back online.
- `notes-export` the export writes the notes, and a new import of that file shows them.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the bar under the slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/nasa-1d-cnn.pptx` exists: slide 1 has a notes part, slide 2 has none.

- **Run it.** `$V journey <run> speaker-notes`. Prints `"passed":true`.
- **Open.** Import the fixture, click `Expand speaker notes`. The field is editable. Evidence `NN-notes-closed`, `NN-notes-open`.
- **Locked.** Click `[data-slide-entry="2"]`. The field is not editable and the locked line shows.
- **Offline edit.** Back on slide 1, go offline, fill the field, see the offline toast, go online; poll `deckRoutes.open` for the `.notes` element's value.
- **Reload, export, import.** The notes come back each time. Evidence `NN-notes-reloaded`, `NN-notes-reimported`.

## Gotchas

- Two buttons are named `Expand speaker notes` while the bar is closed; use `.first()`.
- The notes live on the slide's notes part, keyed `<slide part>.notes` in the server register.
