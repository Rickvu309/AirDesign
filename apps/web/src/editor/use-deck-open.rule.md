# The editor marks a deck ready only when it is painted, opened with the server, its fonts and the thumbnails in view are in, and no zoom is settling

`use-deck-open.test.tsx` marks the deck opened only after its index is sent and its edits are flushed. `packages/render/src/filmstrip.test.ts`, `font-wait.test.ts` and `use-grid-viewport.test.tsx` hold the deck unsettled while a near thumbnail, a face or a zoom's place is pending. `tests/browser/deck-ready-font.spec.ts` paints a deck's text while its font is held and marks it ready once the font is in
