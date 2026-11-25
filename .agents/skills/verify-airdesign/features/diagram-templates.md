# Diagram templates

Process, architecture and cycle are library specs. The interpreter expands them into cards and connectors. Each connector keeps its attachment when a card moves.

## Sub-features

- Process lays 3 to 8 numbered cards in an auto layout row or column. Each card has a title and an optional single-line description.
- Architecture draws one band per layer. Adjacent-layer links use the gap between bands. Skip-layer links use both gaps and the side gutter. Links over intervening cards in the same band use the space above the cards.
- Cycle places 3 to 6 steps on an ellipse with curved or straight connectors.
- Cards in a fit group shrink together. Labels wrap and finish with an ellipsis when needed. The source text stays editable and the expansion reports one finding for each label that cannot fit.

## How to get to it (user POV)

The journey lands the library expansions as ordinary layers. Cmd/Ctrl-click a card to select it inside its frame. A process step moves after Remove auto layout on the frame. The Design panel offers Fill and Border. MCP reads and sets padding, fill, outline and radius through the ordinary layer tools.

## Driving it with verify-airdesign

Run the `diagram-templates` journey on an isolated stack. It expands with served Geist on the Technical theme, compares the saved rows, captures canvas and filmstrip, exports PDF, and checks that card moves preserve the connector attachments. It also checks the 3–8 step range in both directions, resolves an impossible label, and reads back the MCP card edits.

## Gotchas

- A process description is one line. A long description ends in an ellipsis at 7 or 8 steps in a row, while the bottom of the card stays empty.
- The ellipsis turns on only when the text part has a fill. A label that is just too wide raises no finding.
- Skip-layer links can share a gutter lane with unrelated links and read as the wrong connection. Judge architecture links from the canvas, not the saved rows.
