# Add a picture

In an open deck, `Add picture` in the toolbar opens the file picker for PNG, JPEG and GIF. A dropped or pasted picture file does the same. The picture lands centred at its natural size, scaled down to fit the slide with a margin, and a corner drag keeps its ratio. Its bytes stay on the device and paint at once; the slide command carries only their SHA-256 and media type. The bytes upload to the deck's media through `deckRoutes.mediaUpload` and a presigned PUT, and another device reads them through `deckRoutes.media`.

## Sub-features

- `picture-add` `button "Add picture"` and a file. The server's `register.order` gets one `slide: "element-add"` row with `element.kind: "picture"` and `media: { sha256, type }`.
- `picture-refuse` an SVG, any other type, a file of 10 MB or more, or a file the browser cannot decode paints nothing and shows `Unable to add picture.` with what to choose.
- `picture-upload` the bytes upload after the command; a failed upload retries when the editor next opens the deck or comes back online (`flushOriginal` flushes media too).
- `picture-uploading` another device paints the box with `Picture is still uploading from another device` until the bytes land, and its export refuses with `Unable to export. A picture is uploading.`
- `picture-export` the export writes a `p:pic` with `a:blip r:embed`, a `ppt/media/picture-<hash>.<ext>` part, the slide relationship and the content type default; a new import paints it.
- Adding a picture is not on the person's undo list today.

## Driving it with verify-airdesign

- **Run it.** `$V journey <run> picture-add`. Prints `"passed":true`.
- **Add while the upload is blocked.** A second browser context (the first device) blocks the picture's PUT, makes a blank deck and adds `scripts/pptx-fixtures/picture.png`. Polls `deckRoutes.open` for the `element-add` row with its media; `deckRoutes.media` answers `missing`. Evidence `first-device-picture-added.png`.
- **Another device.** The kit's page opens the deck: placeholder text, evidence `NN-picture-uploading`; Export refuses, evidence `NN-export-waiting`.
- **Upload lands.** The first device unblocks and reloads; `deckRoutes.media` answers ok. The kit's page reloads and paints the picture, evidence `NN-picture-added`, exports, imports the file, evidence `NN-reimported`.
