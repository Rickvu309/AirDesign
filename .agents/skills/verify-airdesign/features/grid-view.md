# Grid view

A person sees the whole deck at once: `button "Grid view"` beside the mark in the editor's sidebar opens the slides on the grey canvas, filling the window, fit to it. It is the same slide list, so picking, dragging, the slide menu, skip and the slide keys work as they do in the list. A double click on a slide opens it on the canvas.

## Sub-features

- `bars` a floating bar at the top left holds the way home, the deck's name, `New slide`, `button "Slides view"` and a pressed `button "Grid view"`. A bar at the top right holds the zoom menu, Present and Export. The bottom bar is the editor's toolbar, as in Slides view: picking the hand, a shape, text or Actions opens the current slide with that tool ready, and the Agent and Design switch opens the panel, and closes it when the shown one is pressed again; with the panel open its head carries zoom, Present and Export and the top right bar is gone.
- `lines` the list (`[data-slide-list][data-slide-grid]`) is lines of slides (`[data-slide-grid-line]`), four to ten to a line, chosen once for the deck. Each slide group starts on its own line and a long group wraps as one group. Groups are told apart by spacing alone. The slide's number is above it, and the current and picked slides have a blue outline (`apps/web/src/editor/slide-grid-layout.ts`).
- `zoom` the zoom menu starts at fit, which shows every slide inside the room (`[data-grid-room]`) with a margin. A percent sets the slides to that share of the deck's slide size, and the room scrolls.
- `keys` Left and Right step one slide, Up and Down step to the slide above or below (`apps/web/src/editor/slide-grid-step.ts`), Home and End go to the ends. The slide keys of the list still apply. Undo and redo work with the canvas closed (`apps/web/src/editor/use-grid-history-keys.ts`).
- `open` a double click makes the slide current and closes the grid. `Slides view` closes it on the current slide.

## How to get to it (user POV)

- An open deck: the `Grid view` button at the top of the slide list, to the right of the mark.

## Driving it with verify-airdesign

- **Spec.** `tests/browser/editor-slide-grid.spec.ts` opens the grid on six slides, steps with the arrows, drags a slide, deletes one, undoes both, and opens a slide with a double click.
- **State for look.** `slide-grid`: nine slides in the grid at fit, with slide 4 current.

## Gotchas

- The canvas is not in the page while the grid shows: `[data-editor-canvas]` has count 0.
- The right panel is closed when the grid opens: `complementary` has count 0 until Agent or Design is pressed.
