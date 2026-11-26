# Grid view

A person sees the whole deck at once on a canvas they pan and zoom: `button "Grid view"` beside the mark in the editor's sidebar replaces the slide list and the slide canvas with every slide, one block per slide group, fit to the window. A double click or Enter on a slide opens it in Slides view.

## Sub-features

- `bars` a floating bar at the top left holds the way home, the deck's name, `New slide`, `button "Slides view"`, a pressed `button "Grid view"` and, while several slides are picked, their count (`[data-grid-selected]`). A bar at the top right holds the zoom menu, `button "Side panel"`, Present and Export. The bottom bar is the editor's toolbar: the hand stays in Grid and pans; a shape, text or Actions opens the current slide with that tool ready. Grid view starts with the side panel closed, Slides view with it open, and each view remembers its own; with the panel open its head carries zoom, Present and Export.
- `layout` each Doom `slideRow` is a slide group and starts its own line; groups are told apart by spacing alone. The column count is chosen once for the deck, four to ten, and widened while that saves lines; a group longer than that wraps onto lines closer together than the gap between groups (`apps/web/src/editor/grid-lines.ts`, `gridLayout`). Each slide is painted once at the deck's size and scaled (`apps/web/src/editor/grid-card.tsx`); a slide more than 200 px off screen is not painted.
- `camera` `[data-grid-viewport]` holds the slides at a pan and a zoom (`apps/web/src/editor/use-grid-camera.ts`, math in `grid-viewport.ts`). The wheel pans, Shift turns it sideways, Ctrl or Cmd with the wheel and a pinch zoom about the pointer. Space-drag, the hand tool (H, back with V), the middle button and a touch on empty canvas pan; the arrows pan while no slide has focus. The zoom menu types a percent from 1 to 400 and steps, Shift+1 fits the deck, Shift+2 fits the picked slides, Shift+0 is 100 %. At fit the deck refits when the window or the panel changes; at a chosen zoom a resize pans or zooms out only when it would clip the picked slides. The pan and zoom are kept per deck in `localStorage` (`airdesign.grid-viewport.<deck>`); a deck left at fit opens at fit.
- `numbers` a slide's number sits above it when the gap between groups is at least 88 px on screen, inside its top-left corner below that, and is hidden on a slide under 88 px wide (`apps/web/src/editor/grid-number.ts`).
- `pick` a click picks one slide and makes it current; Shift picks the range from the anchor, Ctrl or Cmd adds or takes one away; Ctrl or Cmd+A picks every slide; Escape or a click on empty canvas clears and announces it. A drag on empty canvas draws a marquee that picks every slide it crosses, live, across groups; Shift adds to what was picked; Escape restores; it pans the canvas near an edge (`apps/web/src/editor/use-grid-marquee.ts`, `grid-marquee.ts`, `grid-interaction.ts`).
- `keys` the slides are one tab stop. Left and Right step one slide, Up and Down step to the nearest slide above or below (`apps/web/src/editor/editor-grid-keys.ts`), Home and End go to the ends, Shift extends the pick. Undo and redo work with the canvas closed (`apps/web/src/editor/use-grid-history-keys.ts`).

## How to get to it (user POV)

- An open deck: the `Grid view` button at the top of the slide list, to the right of the mark.

## Driving it with verify-airdesign

- **Specs.** The Grid specs under `tests/browser/` whose names start with `grid-` and `tests/browser/editor-slide-grid.spec.ts`.
- **State for look.** `slide-grid`: nine slides in the grid at fit, with slide 4 current.
- **Designed screens.** `/screens/s44-01-editor-grid-fit`, `/screens/s44-02-editor-grid-several-picked`, `/screens/s44-03-editor-grid-zoomed-in`, on the sample deck split into three slide groups.

## Gotchas

- The slide canvas and the slide list are not in the page while Grid shows: `[data-editor-canvas]` and `[data-editor-sidebar]` have count 0.
- The right panel is closed when Grid opens: `complementary` has count 0 until Agent or Design is pressed.
- Dragging slides, adding in a gap, the slide menu and slide commands in Grid come in a later change.
