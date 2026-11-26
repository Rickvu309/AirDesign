# A press inside the live Grid slide belongs to that slide's editor alone

A press that lands inside the live slide in Grid (`[data-grid-edit]`) is the canvas's: it selects, moves or boxes layers, and the Grid never also grabs the slide beneath it. `apps/web/src/editor/editor-grid.tsx` keeps such a press out of the slide drag. `tests/browser/grid-editing-marquee.spec.ts` fails when a layer drag on the live slide shows the slide ghost or marks the Grid as dragging, and when a drag on the live slide's blank paint draws anything but the layer box.
