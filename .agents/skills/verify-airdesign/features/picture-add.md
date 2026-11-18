# Add a picture

In an open deck, `Add picture` in the toolbar opens the file picker for PNG, JPEG and GIF. A dropped or pasted picture file does the same. The picture lands at its natural size, scaled down to fit 90% of the slide, in clear space when the slide has room for it and centred over what the slide holds when it has none; a corner drag keeps its ratio. Its bytes stay on the device and paint at once; the slide command carries only their SHA-256 and media type. The bytes upload to the deck's media through `deckRoutes.mediaUpload` and a presigned PUT, and another device reads them through `deckRoutes.media`.

## Sub-features

- `picture-add` `button "Add image"` and a file. The server's `register.order` gets one `slide: "element-add"` row with `element.kind: "picture"` and `media: { sha256, type }`. The new picture frame (`group "Image"`) has focus.
- `picture-refuse` an SVG, any other type, a file of 10 MB or more, or a file the browser cannot decode paints nothing and shows `Unable to add picture.` with what to choose.
- `picture-upload` the bytes upload after the command; a failed upload retries when the editor next opens the deck or comes back online (`flushOriginal` flushes media too).
- `picture-uploading` another device paints the box with `Picture is still uploading from another device` until the bytes land, and its export refuses with `Unable to export. A picture is uploading.`
- `picture-undo` `Undo add picture` takes the picture away and its Redo brings it back, through a reload (`tests/browser/picture-add.spec.ts`).
- `picture-account` each account on a browser keeps its own list of the pictures it added or fetched; another account on the same browser reads nothing of them from the device.
- `picture-export` the export writes a `p:pic` with `a:blip r:embed`, a `ppt/media/picture-<hash>.<ext>` part, the slide relationship and the content type default; a new import paints it. An export of a slide range that holds the picture keeps it (see `export.md`).

## How to get to it (user POV)

- An open deck `/deck/<id>`: the picture button in the toolbar under the slide (`Add picture`), or Tab to it and press Enter.
- Drop or paste a picture file on the open deck.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/picture.png` exists (480 by 320 px).

- **Run it.** `$V journey <run> picture-add`. Prints `"passed":true`.
- **Add while the upload is blocked.** A second browser context (the first device) blocks the picture's PUT, makes a blank deck and adds `scripts/pptx-fixtures/picture.png`. Polls `deckRoutes.open` for the `element-add` row with its media; `deckRoutes.media` answers `missing`. Evidence `first-device-picture-added.png`.
- **Another device.** The kit's page opens the deck: placeholder text, evidence `NN-picture-uploading`; Export refuses, evidence `NN-export-waiting`.
- **Upload lands.** The first device unblocks and reloads; `deckRoutes.media` answers ok. The kit's page reloads and paints the picture, evidence `NN-picture-added`, exports, imports the file, evidence `NN-reimported`.
- **States for look.** `picture-added`, `picture-uploading`, `picture-export-waiting`.

## Gotchas

- `page.waitForEvent("filechooser")` before the click or the Enter, then `setFiles`.
- A painted picture is a frame whose `background-image` is a `blob:` address; poll for it with `getComputedStyle`, not for an `img`.
- On a slide already holding a title, a subtitle and a table, `picture.png` has no clear space and covers the title; click elements under it through the slide list and the keyboard, or add the picture last.
