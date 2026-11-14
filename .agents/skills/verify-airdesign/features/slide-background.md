# Set a slide's background colour

On an open deck, the Design panel shows the current slide's background and the deck's ten theme colours. A click on a colour fills that slide's background with it. The canvas and the thumbnail paint it at once, and Undo gives the slide back the background it had, including the one it took from its layout or master. An agent sets the same background with `airdesign_set_background`. The export writes `p:bg` in that slide's part only.

## Sub-features

- `background-set` a theme colour from the Colors group. The server's `register.order` gets a `slide: "background"` row with `color: { scheme }`. The Background row names the colour, and that colour's button is pressed.
- `background-undo` `Undo background color` and `Redo background color`. Undo sends a row with the colour before, `null` when the slide used the file's own background.
- `agent-background` `airdesign_set_background` with a theme or RGB colour, through the same op and run as every other agent tool. The person's Undo for the run takes it back.
- `background-export` the export changes only that slide's part, with `<p:bg><p:bgPr><a:solidFill>…</a:solidFill><a:effectLst/></p:bgPr></p:bg>` first in `p:cSld`.

## How to get to it (user POV)

- An open deck `/deck/<id>`: `Design` beside `Agent` in the toolbar opens the panel for the slide on the canvas.
- Template and a picture background show as not available yet.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> slide-background`. Prints `"passed":true`.
- **Panel.** A blank deck from `New deck`, then `Design`. Evidence `NN-design-panel`.
- **Set.** `Accent 1`. Evidence `NN-background-set`. `deckRoutes.open` holds one `background` row.
- **Undo, redo, reload.** Evidence `NN-background-undone`.
- **Agent.** `airdesign_read_deck`, `airdesign_set_background` with `{ rgb: "1F4E79" }`, `airdesign_stop_run`. The open editor paints it. Evidence `NN-agent-background`.
- **Export.** The exported slide reads back a solid `1F4E79` background. Evidence `slide-background.pptx`.
- **States for look.** `design-panel`, `background-set`.

## Gotchas

- A build without the panel still reaches both states so the before side of a comparison has a picture: the Design tab is off.
- A colour button that is already pressed does nothing, so a second click adds no Undo step.
