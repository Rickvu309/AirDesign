# A PDF export puts each slide on its own 16:9 page, painted across the whole page, with embedded fonts and text a reader can copy

`pnpm check:pdf` exports the sample deck through the editor's Export button and reads the file with poppler. It fails on a missing page, a page that is not 16:9, a font that is not embedded or has no Unicode map, a slide line `pdftotext` cannot read, and a first slide that paints less than the page width, which is how Chrome's print shrank every page to 77 % until each print page held `contain: strict`. `scripts/pdf-check.test.mjs` holds each of those faults.
