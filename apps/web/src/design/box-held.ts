import type { ScopedElement, TraitReads } from "@airdesign/document"

export function boxSides(view: ScopedElement, reads: TraitReads): Readonly<Record<string, unknown>> {
  if (view.shown !== undefined) {
    const { box, rot, flipH, flipV } = view.shown
    return { x: box.x, y: box.y, w: box.cx, h: box.cy, rot, flipH, flipV }
  }
  const box = view.box
  return {
    x: box?.x,
    y: box?.y,
    w: box?.cx,
    h: box?.cy,
    rot: reads["box.rot"]?.value ?? 0,
    flipH: reads["box.flipH"]?.value ?? false,
    flipV: reads["box.flipV"]?.value ?? false,
  }
}
