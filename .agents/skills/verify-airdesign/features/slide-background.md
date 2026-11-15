# Set a slide's background colour

On an open deck, the Design panel shows the current slide's background and the deck's ten theme colours. A click on a colour fills that slide's background with it: a fill row on the slide's own node, `<slide>.slide`. The canvas and the thumbnail paint it at once, and Undo gives the slide back the background it had, including the one it took from its layout or master. An agent sets the same fill with `airdesign_edit_deck` and `{ "op": "set", "target": "<slide>", "fill": { "value": … } }`. The export writes `p:bg` in that slide's part only.

## Sub-features

- `background-set` a theme colour from the Colors group. The server's `register.elements["<slide>.slide"]` gets a row `{ fill: { value: { set: { solid: { scheme } } } } }`. The Background row names the colour, and that colour's button is pressed.
- `background-undo` `Undo background color` and `Redo background color`. Undo sends a row with the fill before, `"opening"` when the slide showed the background it opened with.
- `agent-background` `airdesign_edit_deck` `set` with the slide id as target and a fill value, through the same run as every other agent change. The person's Undo for the run takes it back. `airdesign_read_deck` lists `<slide>.slide` with its fill.
- PR 478 stored backgrounds as `slide: "background"` commands in `register.order`. Migration 14 rewrote each one into fill rows on `<slide>.slide` and kept the old register in `deck.background_backup`. A device that still holds one from an older build reads it as a fill row (`packages/live/src/background-fill.ts`), and the commit route refuses it.
- `background-export` the export changes only that slide's part, with `<p:bg><p:bgPr><a:solidFill>…</a:solidFill><a:effectLst/></p:bgPr></p:bg>` first in `p:cSld`.

## How to get to it (user POV)

- An open deck `/deck/<id>`: `Design` beside `Agent` in the toolbar opens the panel for the slide on the canvas.
- Template and a picture background show as not available yet.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> slide-background`. Prints `"passed":true`.
- **Panel.** A blank deck from `New deck`, then `Design`. Evidence `NN-design-panel`.
- **Set.** `Accent 1`. Evidence `NN-background-set`. `deckRoutes.open` holds one fill row on `<slide>.slide` and no `background` command.
- **Undo, redo, reload.** Evidence `NN-background-undone`.
- **Agent.** `airdesign_read_deck`, `airdesign_edit_deck` with `{ "op": "set", "target": "<slide>", "fill": { "value": "#1F4E79" } }`, `airdesign_stop_run`. The open editor paints it, and `airdesign_read_deck` lists `<slide>.slide` with `1F4E79`. Evidence `NN-agent-background`.
- **Export.** The exported slide reads back a solid `1F4E79` background. Evidence `slide-background.pptx`.
- **States for look.** `design-panel`, `background-set`.

## Gotchas

- A build without the panel still reaches both states so the before side of a comparison has a picture: the Design tab is off.
- A colour button that is already pressed does nothing, so a second click adds no Undo step.
