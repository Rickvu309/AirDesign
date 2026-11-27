# Add a picture

In an open deck a PNG, JPEG or GIF file dropped on the canvas lands at the drop point, and one pasted from the clipboard lands centred on the slide. The picture keeps its own ratio at its natural size, scaled down to fit the slide, and stays inside the slide's edges. It is a rectangle whose fill is the image (`fills: [{ kind: "image", asset, fit: "fill" }]`). Its bytes stay on the device and paint at once; the deck stores only their SHA-256 as the asset. The bytes upload to the deck's media through `deckRoutes.mediaUpload` and a presigned PUT, and another device reads them through `deckRoutes.media`. The Design panel's Fill picks an image file for a shape, a picture's Replace, and the slide background in the same way.

## Sub-features

- `picture-drop` a dropped file lands as one edit (Doom's `insert` intent of a `picture`, placed by `pictureBox` in `apps/web/src/editor/picture-box.ts`), selected, painted from a `blob:` address. One undo takes it away and redo brings it back; a reload and a fresh device paint it.
- `picture-paste` a picture file pasted outside a text lands centred on the slide.
- `picture-refuse` a file that is not a PNG, JPEG or GIF, a file at or over the media limit or past the pixel limit, or one the browser cannot decode lands nothing and shows what to choose instead (`pictureCopy` in `apps/web/src/copy/picture-copy.ts`).
- `picture-upload` the picture paints and lands in the deck while its upload fails; the upload goes through when the device is back online (`flushMedia` in `packages/live/src/media.ts`).
- `picture-uploading` a device that does not hold the bytes paints the box with `Image is still uploading from another device`.
- `picture-fill` the Design panel's Fill `Image` picks a file for a shape's fill, the slide background, or a picture's `Replace`, and the panel shows it (see `design-panel.md`).
- `agent-picture` an agent's `airdesign_execute` operation, Doom's change `{ op: "add", kind: "picture", slide, fill: { image: "https://…" } }` lands a picture. The API fetches the address once (`apps/api/src/platform/image-fetch.ts`): https on the default port only, every resolved address and every redirect public, at most three redirects, 10 s, at most `imagesPerCall` (10) addresses a call. A failed address refuses the call with one line per address saying why (`packages/agent/src/named-image.ts`). In the stack, `images.verify.test` answers from `tests/browser/fixtures/` (see `../stand-ins.md`). An agent's first read of a slide with a picture gets the slide as the open tab painted it (`tests/browser/editor-slide-picture.spec.ts`, `tests/browser/editor-screenshot-wake.spec.ts`).

## How to get to it (user POV)

- An open deck `/s/<id>`: drop a picture file on the canvas, or paste one.
- The Design panel with a shape, a picture or nothing selected: Fill or Background, then `Image`.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `tests/browser/fixtures/picture.png` exists (480 by 320 px).

- **Browser tests.** `pnpm test:browser tests/browser/editor-picture.spec.ts`: a dropped `picture.png` lands at the drop point at 1.5 to 1, its asset is on the server and `deckRoutes.media` answers ok, undo and redo, a reload and a fresh device paint it; a pasted picture lands centred and a text file lands nothing with `Unable to add image.`; a drop while the upload fails lands, and the upload goes through once the device is back online. `tests/browser/editor-design.spec.ts` picks an image fill for a shape, the slide background and a picture's Replace.
- **States for look.** `picture-added`, `picture-uploading` (a picture whose bytes this device lacks), `design-picture-fill`, `panel-picture`.

## Gotchas

- A painted picture is `[data-slide-box] [data-paint="image"]` whose `background-image` is a `blob:` address; poll for it with `getComputedStyle`, not for an `img`.
- The spec dispatches the drop and the paste on `[data-editor-stage]` as a `DragEvent` or `ClipboardEvent` with a `DataTransfer` holding the file.
- A browser spec serves the upload's presigned PUT and GET itself with `serveOriginals` from `tests/browser/editor-deck.ts`; the verify stack serves them under `/verify-original/`.
