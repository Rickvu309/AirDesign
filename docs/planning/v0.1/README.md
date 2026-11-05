# AirDesign v0.1 planning

What v0.1 promises and why. Read this index to pick a board. Open the text for the rules. Open the image to check the exported layout.

Exported from the Brilliant project "airdesign", Strategy canvas, on 2026-11-04. Each board is text in `content/` and an image in `boards/`. Screens, components and logic are in [docs/design/v0.1](../../design/v0.1/README.md).

## Architecture

Read when placing a module, ordering build work, deciding how slides draw, or checking an engine limit.

- [Key Components](content/key-components.md) ([image](boards/key-components.png)): modules, what to build first, and relative size.
- [Monorepo Map](content/monorepo-map.md) ([image](boards/monorepo-map.png)): target apps and packages, where each runs, stores, tests and stack.
- [Rendering Approach](content/rendering-approach.md) ([image](boards/rendering-approach.png)): how slides draw, capture and measure.
- [Engine Constraints](content/engine-constraints.md) ([image](boards/engine-constraints.png)): numbered fixed points for import, export, sync, undo, agent tools and the quality gate.

## Journeys

Read the flow for the journey you are changing. F13 is retired. Stage and status for every flow are on the journey board.

- [Journey Flow](content/journey-flow.md) ([image](boards/journey-flow.png))
- [Sign In Flow](content/sign-in-flow.md) ([image](boards/sign-in-flow.png))
- [F02 First Deck Flow](content/f02-first-deck-flow.md) ([image](boards/f02-first-deck-flow.png))
- [F03 Edit And Refine Flow](content/f03-edit-and-refine-flow.md) ([image](boards/f03-edit-and-refine-flow.png))
- [F04 Export Flow](content/f04-export-flow.md) ([image](boards/f04-export-flow.png))
- [F05 Import Flow](content/f05-import-flow.md) ([image](boards/f05-import-flow.png))
- [F06 Connect Agent Flow](content/f06-connect-agent-flow.md) ([image](boards/f06-connect-agent-flow.png))
- [F11 Templates Flow](content/f11-templates-flow.md) ([image](boards/f11-templates-flow.png))
- [F12 Images Flow](content/f12-images-flow.md) ([image](boards/f12-images-flow.png))
- [F07 Usage Flow](content/f07-usage-flow.md) ([image](boards/f07-usage-flow.png))
- [F08 Next Deck Flow](content/f08-next-deck-flow.md) ([image](boards/f08-next-deck-flow.png))
- [F14 Manage Decks Flow](content/f14-manage-decks-flow.md) ([image](boards/f14-manage-decks-flow.png))
- [F09 Settings Flow](content/f09-settings-flow.md) ([image](boards/f09-settings-flow.png))
- [F10 Learn Flow](content/f10-learn-flow.md) ([image](boards/f10-learn-flow.png))
- [F15 Something Wrong Flow](content/f15-something-wrong-flow.md) ([image](boards/f15-something-wrong-flow.png))

## Writing and backlog

Board exports of the copy kit and the design backlog. Edit the keyed handoff in the design folder: [copy kit](../../design/v0.1/copy-kit.md) and [backlog](../../design/v0.1/backlog.md).

- [Copy kit](content/copy-kit.md) ([image](boards/copy-kit.png))
- [Design backlog](content/design-backlog.md) ([image](boards/design-backlog.png))

## Research

Read the matching README before changing a fixed point in Engine Constraints. Each folder has sources, proposed constraints, risks and the command that runs its prototype from that folder. Prototypes are evidence, not product code. Run one only from its own folder. The repo root has no install or test command.

- [PowerPoint import and export](research/pptx/README.md)
- [Live sync and undo](research/sync/README.md)
- [Agent tools](research/tools/README.md)
- [Measuring stunning slides](research/quality/README.md)

## Delivery

Read when ordering the nine-PR build or checking what a PR must prove. The plan is the sequence and its checks. It does not authorize implementation, spending, publication or a merge.

- [Autopilot plan](delivery/autopilot-plan.md)
