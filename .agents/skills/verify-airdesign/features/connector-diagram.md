# Connectors and diagrams

A connector's ends attach to numbered sites on the shapes and pictures of its slide. A person selects a connector, drags one of its two round end grips over a shape, sees that shape's sites as dots, and lets go on one: the end attaches there and the connector redraws between its two sites. When an attached shape moves, resizes or turns, the connector follows it on screen during the drag and before the network, through Undo, a reload and the export; an elbow connector bends where PowerPoint would. Letting go of an end away from every site leaves it at that point, freed. The design panel's Connector section names the shape and site each end attaches to. An agent adds a diagram in one change: rounded shapes joined by attached arrows, all grouped.

## Sub-features

- `connector-ends` a selected connector shows two round grips at its ends instead of corner grips. Dragging one shows the sites of the shape under the pointer and marks the nearest within 12 px; letting go there lands one `connection` row on the connector. Letting go on an empty part of the slide lands one row that frees that end and moves it there. `Undo connector` takes either back. An attached connector does not move by its body or the arrow keys.
- `connector-follows` while a person drags or resizes a shape a connector attaches to, the canvas routes the connector from the shape's live box, so it follows during the drag; after the drop, or a turn in the panel, it repaints from the export with the network off; `Undo move` puts both back. An elbow's route writes its turn, flips and `adj` values: the bend sits midway, or 0.25 in past both shapes when the two sites face the same way.
- `connector-panel` the Connector section has Start and End, each None or Shape, with Attached to (the slide's shapes and pictures by name) and Site.
- `agent-diagram` an agent sends `{op: "diagram", slide, labels: [...]}` in `airdesign_edit_deck`: one rounded shape per label, left to right, each joined to the next by an arrow attached right site to left site, then one group. The panel's Undo for the run takes it all back.

## How to get to it (user POV)

- An open deck with a connector, such as `census-updating-spm.pptx` slide 10: click the dashed line, then drag a round end onto a shape.
- The Design panel with a connector selected.
- Ask Aira for a flow of steps on a slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> connector-diagram`. Prints `"passed":true`. It is in the `recorded Aira` group of `tests/journeys/journeys.spec.ts`.
- **Attach.** `census-updating-spm.pptx` slide 10, the connector selected with the Design panel open (`NN-connector-panel`); its end dragged to the right site of the picture it ends on (`NN-connector-aim`, the four sites showing and site 3 marked); `deckRoutes.open` holds the row with site 3 (`NN-connector-bound`).
- **Follow, reload, export, reimport.** The picture dragged 60 px; the connector follows (`NN-connector-followed`); `Undo move` and `Redo move`; reload; evidence `connector-diagram.pptx` and `NN-connector-reimported`.
- **Agent.** A blank deck; the replayed stream `diagram.sse` calls `airdesign_edit_deck` with `op: "diagram"` and labels Plan, Build, Ship (`NN-diagram-made`); the order holds three shapes, two connectors and a group under the run; evidence `diagram.pptx` and `NN-diagram-reimported`; the panel's Undo, in the same session, takes the diagram away (`NN-diagram-undone`).
- **States for look.** `connector-panel`, `connector-aim`, `diagram-made`.
- **Follow and free, on elbows.** `$V journey <run> connector-follow` on `connectors.pptx`: Build dragged with the mouse still down, both elbows already on its sites (`NN-connector-follow`), `deckRoutes.open` holds the box row, `Undo move`; then the elbow's end let go on an empty part of the slide (`NN-connector-freed`), `deckRoutes.open` holds the end's `none`, `Undo connector`. States for look: `connector-follow`, `connector-freed`.

## Gotchas

- The census deck's slide ids differ between the app (326 for slide 10) and an index read straight from the file (324). Match a site's target by its shape, `[data-connector-target$=".15"]`.
- A connector's end grips are round and sit on its ends; its box shows no corner grips. A grip drag ends on a site, or on a point that frees the end; letting go where it was picked up changes nothing.
- The panel's Undo for Aira's run shows only in the session that ran it. Export before the Undo, then import the export.
- A text shape such as Build moves by its selection frame's edge; a press on its text starts typing.
