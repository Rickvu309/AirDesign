# Diagram templates

Process, architecture, cycle, 2×2 matrix and issue tree are library specs. The interpreter expands them into cards and connectors. Each connector keeps its attachment when a card moves.

## Sub-features

- Process lays 3 to 8 numbered cards in an auto layout row or column. Each card has a title, an optional description and an optional duration. A column duration is its own text layer, grouped with its card as the step. Row descriptions can wrap to three lines. The focus step carries the accent and defaults to step one. A process with more than five steps suggests using two diagrams.
- Architecture draws one band per layer. Adjacent-layer links use the gap between bands. Skip-layer links use the band gaps and side gutters. Links can share a line into or out of a card. Unrelated links use separate lanes where the diagram has room.
- Cycle places 3 to 6 steps on an ellipse with curved or straight connectors.
- Matrix uses two titled arrow axes, four action quadrants and labeled dots with optional bubble sizes scaled by area. A focus quadrant takes the accent. Each quadrant groups its tile, action and items, and each item groups its dot and label.
- Issue tree flows left to right. Focus emphasizes a branch and its ancestors. Wide splits, deep branches, crowded leaves and overflowing labels generate findings. Both frameworks give advice when a focus ID is missing and use their default colours.
- Cards in a fit group shrink together. Labels wrap and finish with an ellipsis when needed. The source text stays editable and the expansion reports one finding for each label that cannot fit.

## How to get to it (user POV)

The journey lands the library expansions as ordinary layers. Cmd/Ctrl-click a card to select it inside its frame. A process step moves after Remove auto layout on the frame. In a column, double-click a step to pick its group, and its card and duration move together. The Design panel offers Fill and Border. MCP reads and sets padding, fill, outline and radius through the ordinary layer tools.

## Driving it with verify-airdesign

Run the `diagram-templates` journey on an isolated stack. It expands with served Geist on the Technical theme, compares the saved rows, captures canvas and filmstrip, exports PDF, and checks that card moves preserve the connector attachments. It checks the 3–8 step range in both directions with realistic descriptions, paints an eight-step row and a five-step column with durations, moves a column step with its duration after Remove auto layout, resolves an impossible label, and reads back the MCP card edits. The matrix and issue tree paint on Technical and Midnight. The journey checks MCP template discovery at the current rollout setting, measures an overflowing issue label with served fonts in both themes, and moves an issue branch with its connectors attached.

## Gotchas

- Descriptions that exceed three lines in a row or one line in a column end with an ellipsis.
- Cmd/Ctrl-click a card and press Enter to edit its full text. The spec opts into shortening with `overflow: "ellipsis"`. Width and height can both shorten a label and raise a finding.
- Inspect routes on the canvas. The saved rows store attachment sites and channels. If a card moves past its channel, the elbow router still follows the card.
