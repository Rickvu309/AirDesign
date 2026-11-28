# Mask layers

A person uses a shape or frame as a mask from the layer menu. The mask clips the layers above it in the same stack to its outline. A click on the slide respects the visible paint.

## Sub-features

- `use-mask` `Use as mask` sets the selected shape or frame’s `mask` property. `Remove mask` clears it, and Undo takes the change back.
- `paint` the slide painter clips siblings above the mask, up to the next mask, using its shape and opacity (`packages/render/src/mask-layers.tsx`).
- `select` the canvas hit test respects the mask, so a clipped part of a layer does not take a click.

## How to get to it (user POV)

- In an open deck, right-click a shape or frame on the canvas and choose `Use as mask`. Open the same menu for `Remove mask`.

## Driving it with verify-airdesign

- **Browser spec.** `pnpm test:browser tests/browser/editor-mask-grid.spec.ts` samples painted pixels and checks which layer each click selects across masked scenes.
- **Menu in a scratch journey.** Seed overlapping layers. Right-click the lower shape, choose `Use as mask`, capture the clipped paint and poll `doomRoutes.open` for `mask: true`. Choose `Remove mask` and check the paint and saved property again.

## Gotchas

- The mask affects layers above it in the same parent. Put the shape below the layers it should clip.
- A hidden mask stops clipping its siblings.
