# Export a deck

`Export` at the top right of an open deck opens the Export dialog. The person picks PowerPoint or PDF and all slides, the current slide or a range, and exports. A PowerPoint export downloads `<name>.pptx` built on the device from the original file and the deck's edits, with every part nobody touched kept byte for byte; a PDF export opens the browser's print window with one page per slide.

## Sub-features

- `export-dialog` `button "Export"` opens `dialog "Export"` with `combobox "File type"` (`PowerPoint`, `PDF`), `combobox "Slides"` (`All slides`, `Current slide`, `Range`) and `button "Export"`, which has focus, so Export then Enter exports the whole deck as PowerPoint. Focus stays inside; Escape or `Close` closes it and focus goes back to the toolbar's `Export` (`apps/web/src/export/export-dialog.tsx`, words in `export-options.ts`).
- `export-range` `Range` shows `spinbutton "First slide"` and `spinbutton "Last slide"`. A range outside the deck, or a first slide after the last, shows the alert `Choose slides from 1 to <n>, first slide before last.` and disables `Export`. The export removes the slides not chosen, the way a deleted slide is removed, so sections, notes, layouts and relationships stay valid.
- `export-pdf` `PDF` says `Your browser's print window opens next. Choose Save as PDF there.` and Export opens the print window, one slide per page at the slide's own size, text selectable.
- `export-working` while it runs the button reads `Exporting…` and the fields are disabled; Cancel stops it and nothing downloads.
- `export-done` the browser saves `<name>.pptx` and the app shows no notice; the browser's own download UI says the file arrived (see `deck-names.md`). A failed export shows `Unable to export. Your deck is unchanged.` with `Try again`, which repeats the same slide choice; while a picture is still uploading from another device it shows `Unable to export. A picture is uploading.`
- `export-waits` the export waits for speaker notes still on their way and refuses while a picture's bytes are missing on this device.
- `export-offline` the export runs on the device, so it works with no network.

## How to get to it (user POV)

- An open deck `/deck/<id>`: `Export`, top right. From the keyboard it is the last Tab stop of the head; 17 Tabs from the first slide entry of `clean.pptx`.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Whole deck.** `deck-names`, `speaker-notes`, `element-edits`, `picture-add` and `slide-kept-parts` export through the dialog with Export then Enter.
- **Range with a picture and new notes.** Driven live on 2026-11-13 with a scratch journey: a blank deck with three slides, a picture added and notes typed on slide 2, notes typed on slide 3 just before opening the dialog, `Range` 2 to 3. The file held two slides, a `p:pic` with `ppt/media/picture-<hash>.png`, and both notes; its new import showed two slides, the picture and each slide's notes.
- **Keyboard only.** Driven live the same day: Tab to `Export`, Enter, Shift+Tab to `Slides`, Enter, ArrowDown to `Current slide`, Enter, Tab to `Export`, Enter. One slide with its table, picture and notes downloaded, and focus came back to `Export`.
- **Offline.** With the context offline, Export then Enter saved `<name>.pptx`.
- **Specs.** `tests/browser/export-dialog.spec.ts` (current slide byte for byte, a blank deck's range, focus, Cancel, PDF pages); `pnpm check:pptx` judges the subset exports with Microsoft's validator.

## Gotchas

- Wait for `page.waitForEvent("download")` before the Enter that exports.
- The options are a Base UI select: click or press Enter on the combobox, then pick `getByRole("option", { name })`.
- The file name is the deck's name, not the range: a range export of `Blank deck` saves `Blank deck.pptx`.
