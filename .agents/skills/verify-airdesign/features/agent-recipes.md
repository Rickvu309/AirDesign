# Agent recipes and kit pieces

Aira and connected agents read AirDesign’s design guides and build slides from ready-made pieces or recipes. The person can edit the resulting layers on the slide.

## Sub-features

- `guides` call `airdesign_read_skill` to list guides, or pass `{ name }` to read one. `airdesign_get_style` reads a style guide and its parameters (`packages/agent/src/skill-tools.ts`).
- `kit` read `kit`, then copy a piece with `copy({ from: "kit/title-block", parent: slide, box: { x: 120, y: 80 } })` in `airdesign_execute`. The copy has its own editable layers (`packages/agent/src/kit-paste.ts` and `packages/taste/files/kit/SKILL.md`).
- `recipes` read a guide such as `charts/bar`, `charts/table` or `diagrams/process-flow`. Replace its sample data and run the adapted script in one `airdesign_execute` call. It draws editable Doom layers.
- `style` `variables({ style, variant })` applies a style and an optional variant to the deck.

## How to get to it (user POV)

- Ask Aira in an open deck or ask a connected agent to build a slide with a chart, table or diagram. Select its layers on the canvas to edit them.

## Driving it with verify-airdesign

- **Tools and recipes.** Run `pnpm exec vitest run packages/agent/src/skill-tools.test.ts packages/agent/src/kit-copy.test.ts packages/agent/src/taste-fitness.test.ts` for guide reads, editable copies and recipe output across styles.
- **In a scratch journey.** Open the deck in the editor, read `kit` and one recipe over MCP, then copy a piece and run the recipe with sample data. Check the new layers on the canvas and poll `doomRoutes.open` for their saved values.

## Gotchas

- A copied piece has its own layer IDs. Use the IDs returned by `copy` to find and edit its layers.
- `variables({ style, variant })` changes the whole deck.
