# Grid view

A person sees the whole deck at once on a canvas they pan and zoom: `button "Grid view"` beside the mark in the editor's sidebar replaces the slide list and the slide canvas with every slide, one block per slide group, fit to the window. A double click or Enter on a slide opens it in Slides view.

## Sub-features

- `bars` a floating bar at the top left holds the way home, the deck's name, `New slide`, `button "Slides view"`, a pressed `button "Grid view"` and, while several slides are picked, their count (`[data-grid-selected]`). A bar at the top right holds the zoom menu, `button "Side panel"`, Present and Export. The bottom bar is the editor's toolbar: the hand stays in Grid and pans; a shape, text or Actions opens the current slide with that tool ready. Grid view starts with the side panel closed, Slides view with it open, and each view remembers its own; with the panel open its head carries zoom, Present and Export.
- `layout` each Doom `slideRow` is a slide group and starts its own line; groups are told apart by spacing alone. The column count is chosen once for the deck, four to ten, and widened while that saves lines; a group longer than that wraps onto lines closer together than the gap between groups (`apps/web/src/editor/grid-lines.ts`, `gridLayout`). Each slide is painted once at the deck's size and scaled (`apps/web/src/editor/grid-card.tsx`); a slide more than 200 px off screen is not painted.
- `camera` `[data-grid-viewport]` holds the slides at a pan and a zoom (`apps/web/src/editor/use-grid-camera.ts`, math in `grid-viewport.ts`). The wheel pans, Shift turns it sideways, Ctrl or Cmd with the wheel and a pinch zoom about the pointer. Space-drag, the hand tool (H, back with V), the middle button and a touch on empty canvas pan; the arrows pan while no slide has focus. The zoom menu types a percent from 1 to 400 and steps, Shift+1 fits the deck, Shift+2 fits the picked slides, Shift+0 is 100 %. At fit the deck refits when the window or the panel changes; at a chosen zoom a resize pans or zooms out only when it would clip the picked slides. The pan and zoom are kept per deck in `localStorage` (`airdesign.grid-viewport.<deck>`); a deck left at fit opens at fit.
- `numbers` a slide's number sits above it when the gap between groups is at least 88 px on screen, inside its top-left corner below that, and is hidden on a slide under 88 px wide (`apps/web/src/editor/grid-number.ts`).
- `pick` a click picks one slide and makes it current; Shift picks the range from the anchor, Ctrl or Cmd adds or takes one away; Ctrl or Cmd+A picks every slide; Escape or a click on empty canvas clears and announces it. A drag on empty canvas draws a marquee that picks every slide it crosses, live, across groups; Shift adds to what was picked; Escape restores; it pans the canvas near an edge (`apps/web/src/editor/use-grid-marquee.ts`, `grid-marquee.ts`, `grid-interaction.ts`).
- `drag` a press and drag on a slide moves it, or the picked set it belongs to; the grip left of a slide group moves the whole group. A ghost with the count follows the pointer, a blue bar (`[data-drop-bar]`, `data-drop-place` is the slide number it lands before) shows the place, and a single slide moved inside its own group slides its neighbours aside instead. A drop on a group's first slide's left half joins that group at its start. The canvas pans near an edge; Escape, leaving the canvas or a blur cancels. The drop is one write set from `slideGroupMoveWrites` (`apps/web/src/editor/slide-writes.ts`), one undo; a whole group moves its `slideRow` node, a new group mints one, and a group left empty is removed (`use-grid-drag.ts`, `grid-drop.ts`, `grid-move.ts`).
- `grips` a group's grip shows when the pointer is over the group or the band left of it, tints the group while hovered, takes Alt+Up and Alt+Down (`slide-group-up`, `slide-group-down`), and hides during Space, the hand, a drag, and below 80 px slide height. Fit keeps room on the left for the grips while they show (`gridGrip`, `fittedGrid` in `grid-viewport.ts`).
- `adds` a plus in the gap after a slide adds one there in its group; the dot at a group's end previews the new cell. A plus under each group adds a slide in a new group below it, previewed by a dashed line between groups or a placeholder below the last. Both hide below 24 px targets, during Space, the hand, a drag, a marquee, a menu or touch, and on a 50-slide deck. An inline add keeps the zoom rather than refitting.
- `menu` a right click, the Menu key or Shift+F10 opens the slide menu: Open, Duplicate, Delete, Move up, Move down, Skip slide, then Add slide after, Add slide in a new slide group below, Move to a new slide group below. With several picked, the rows act on all of them. Screen `/screens/s44-04-editor-grid-slide-menu`; states `grid-slide-menu`, `grid-slide-drag`.
- `slide keys` on a focused slide or a picked set: Delete or Backspace, Ctrl or Cmd+D, Ctrl or Cmd+[ and ], Alt+Left and Alt+Right (`slide-earlier`, `slide-later`). Each is one undo; copies end up picked; Doom refuses deleting every slide and says so.
- `keys` the slides are one tab stop. Left and Right step one slide, Up and Down step to the nearest slide above or below (`apps/web/src/editor/editor-grid-keys.ts`), Home and End go to the ends, Shift extends the pick. Undo and redo work with the canvas closed (`apps/web/src/editor/use-grid-history-keys.ts`).

## How to get to it (user POV)

- An open deck: the `Grid view` button at the top of the slide list, to the right of the mark.

## Driving it with verify-airdesign

- **Specs.** The Grid specs under `tests/browser/` whose names start with `grid-` and `tests/browser/editor-slide-grid.spec.ts`. Slide actions: `grid-drag.spec.ts`, `grid-add.spec.ts`, `grid-slide-menu.spec.ts`, `grid-slide-keys.spec.ts`, each reading the saved slide groups with `savedGroups` in `grid-deck.ts`.
- **State for look.** `slide-grid`: nine slides in the grid at fit, with slide 4 current.
- **Designed screens.** `/screens/s44-01-editor-grid-fit`, `/screens/s44-02-editor-grid-several-picked`, `/screens/s44-03-editor-grid-zoomed-in`, `/screens/s44-04-editor-grid-slide-menu`, on the sample deck split into three slide groups.

## Gotchas

- The slide canvas and the slide list are not in the page while Grid shows: `[data-editor-canvas]` and `[data-editor-sidebar]` have count 0.
- The right panel is closed when Grid opens: `complementary` has count 0 until Agent or Design is pressed.
- An agent cannot yet start a slide group, put a slide first in a group, or move a whole group: `agent-reach.ts` lists them as owed.
- A test that goes offline routes `/doom/` requests to abort; `context.setOffline` does not stop the stack's forwarded requests.
