# The New slide menu paints each layout from the open deck's theme, size and slide background, and a focused row keeps white text

`apps/web/src/editor/layout-pictures.test.ts` fails when a picture ignores the deck theme, the deck size or the current slide's fills, or when a second ask for the same theme, size and fills builds another picture. `tests/browser/editor-page.spec.ts` fails when the focused or hovered layout name is not white.
