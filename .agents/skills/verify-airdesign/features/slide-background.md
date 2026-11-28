# Set a slide's background

On an open deck with no layer selected, the Design panel shows the current slide: its number, the deck's **Theme**, the slide's **Background** and its **Selection colors**. The background takes a solid colour, a gradient or a picture; the slide and its thumbnail paint it at once, it reaches the server as the slide node's `fills`, and one undo takes it back. An agent sets the same fill with `airdesign_execute` and `update({ target, fill })`.

## Sub-features

- `background-set` in the **Background** section, `Solid` and `Gradient` switch the fill's kind, and `button "Background color, <colour>"` opens the colour picker with the template's colours. The slide node's `fills[0]` becomes `{ kind: "solid", color: { var: "accent3" } }` for a template colour (`tests/browser/editor-design.spec.ts`). States `panel-slide`, `blank-deck-colors`, `color-picker-background`, `selection-colors-slide`.
- `background-gradient` a gradient shows only its stops, direction and angle; `From center` saves a radial one (`tests/browser/editor-gradient-fill.spec.ts`). State `slide-line-and-gradient`.
- `background-picture` an image fill picked from a file fills the slide background (`tests/browser/editor-design.spec.ts`).
- `background-undo` Ctrl/Cmd+Z on the canvas takes the background back to what it was, and a reload keeps the result.
- `theme` opens the library picker and applies a theme to the whole deck. States `design-template` and `design-theme-options`.
- `agent-background` `airdesign_execute` with `update({ target, fill })` where `target` is the slide id paints the slide's background (`packages/doom/src/intent-set.test.ts`, "paints a slide's background"), through the same run as other intents from the agent. The person's Undo for the run takes it back.

## How to get to it (user POV)

- An open deck `/s/<id>`: `Design` beside `Agent` opens the panel; click the empty slide so no layer is selected.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Specs.** `pnpm test:browser tests/browser/editor-design.spec.ts tests/browser/editor-gradient-fill.spec.ts` sets a solid, a gradient, a template colour and a picture on the background, reads each from the saved slide node, undoes and reloads.
- **In a scratch journey.** Make a deck with `newDoomDeck`, click `button "Design"`, click the button whose name starts `Background color`, pick a template colour, press Escape, and poll `post(doomRoutes.open, { deck }, cookie)` until the slide node's `fills[0].color` names it. Click the slide, press Ctrl/Cmd+Z, and poll until it does not.
- **Agent.** Over MCP, `get` in `airdesign_execute`, then `airdesign_execute` with the change `{ "op": "set", "target": "<slide>", "fill": "#1F4E79" }`. The open editor paints it, and `doomRoutes.open` holds the slide node's new `fills`.
- **States for look.** The states named above.

## Gotchas

- Press Escape to close the colour picker, then click the slide before Ctrl/Cmd+Z, so the key reaches the editor's undo and not a field.
- The panel shows the slide only while nothing is selected; a selected layer shows its own sections (`design-panel.md`).
