import type { Box, ScopedElement, SetChange } from "@airdesign/document"

type Rect = { readonly l: number; readonly t: number; readonly r: number; readonly b: number }

const whole = 100_000

function rectOf(value: unknown): Rect {
  const held = typeof value === "object" && value !== null ? (value as Partial<Rect>) : {}
  return { l: held.l ?? 0, t: held.t ?? 0, r: held.r ?? 0, b: held.b ?? 0 }
}

function side(at: number, size: number, before: readonly [number, number], after: readonly [number, number]) {
  const shown = whole - before[0] - before[1]
  const kept = whole - after[0] - after[1]
  if (shown <= 0 || kept <= 0) return null
  const full = (size * whole) / shown
  return { at: Math.round(at + (full * (after[0] - before[0])) / whole), size: Math.round((full * kept) / whole) }
}

export function croppedBox(box: Box, before: unknown, after: unknown): Box | null {
  const was = rectOf(before)
  const next = rectOf(after)
  const across = side(box.x, box.cx, [was.l, was.r], [next.l, next.r])
  const down = side(box.y, box.cy, [was.t, was.b], [next.t, next.b])
  if (across === null || down === null || across.size <= 0 || down.size <= 0) return null
  return { x: across.at, y: down.at, cx: across.size, cy: down.size }
}

export function cropChange(view: ScopedElement, before: unknown): (value: unknown) => SetChange {
  return (value) => {
    const target = { node: view.node }
    const box = view.box === null ? null : croppedBox(view.box, before, value)
    const crop = { rect: value } as SetChange["crop"]
    if (box === null) return { target, crop } as SetChange
    return { target, crop, box: { x: box.x, y: box.y, w: box.cx, h: box.cy } } as SetChange
  }
}
