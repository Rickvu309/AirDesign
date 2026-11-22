# A Figma-style scene is the core; PowerPoint is an adapter

AirDesign's truth becomes its own scene: a tree of nodes, each a flat map of properties, changed by property writes the server orders, the way Figma stores a file. Until now the truth was the PowerPoint file plus field-level byte splices, which made every feature a codec, kept "opening" and "inherit" states, and let PowerPoint's shape (17 traits, 14 kinds, a table and a chart engine each with its own fill, border and text) decide the element model. The owner set the order on 2026-11-22: a lean, omakase core first, PowerPoint second.

The scene has five node types (deck, slide row, slide, frame, shape), and a new one is added only when its behaviour cannot be a property. There is no opaque or kept type: on import, a table becomes a grid frame of text shapes, and content the scene cannot hold becomes a picture of its own fallback image or is dropped. A group is a frame with no paint, a picture is an image paint, an icon and a line are shape geometry, a chart is a frame whose bars are derived from its data, and there is no table. One property list drives the boundary reader, the design panel, the agent schema and the PowerPoint writer.

## Considered options

- Keep the PowerPoint-backed storage and reshape the model above it: lowest risk, but every property keeps a field-level XML codec and an opening value, the cost the owner wants gone.
- A table node, as Figma Slides has: rejected by the owner ("remove table, we actually no need").
- Storing laid-out boxes written by the editing client: rejected after review, since concurrent edits can fold to a box set no client computed. Layout is derived at read time.

## Consequences

- An untouched imported node still exports byte for byte (node-level passthrough by `origin`); an edited node exports from the scene and may lose PowerPoint features the scene does not model, and an edited chart exports as a picture.
- Old stored decks are dropped at cut-over; a person reimports the .pptx.
- Two people typing in one text box resolve by compare-and-set on the text property, not by character merge.
