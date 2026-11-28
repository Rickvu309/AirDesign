# Export a PDF

A person exports a deck from the editor. Each included slide becomes one PDF page, painted on the device with the deck's theme, fonts and images. The browser's print window saves the file.

## Sub-features

- `slides` choose `All slides`, `Current slide` or `Range`. A range includes its first and last slide, and the dialog explains invalid numbers before export.
- `skipped` All slides and Range leave skipped slides out. The dialog explains when no slides in the selection can print. Current slide can export a skipped slide.
- `paint` the chosen slides wait for their fonts and images before print opens. A required font that fails shows a notice in the editor. A failed font on a slide outside the selection does not stop export.

## How to get to it (user POV)

- Open a deck and click `Export`, or press Ctrl/Cmd+P and choose `Export as PDF` from Actions.
- Choose the slides and press `Export` in the dialog. In the print window, set Destination to Save as PDF.

## Driving it with verify-airdesign

- **Browser spec.** `pnpm test:browser tests/browser/export-pdf.spec.ts` checks the dialog, range validation, printed slides, text and links, and slow or failed fonts.
- **PDF check.** `pnpm check:pdf` checks the exported sample deck with Poppler.
- **SVG paths.** Run `$V journey <run> path-paint` and `$V journey <run> path-seams` to compare canvas paint with the exported PDF.

## Gotchas

- Ctrl/Cmd+P opens Actions. Choose `Export as PDF` to reach the dialog.
- Wait for the print sheet’s `[data-print-page]` elements before calling Playwright’s `page.pdf()`.
