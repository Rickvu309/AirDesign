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

type CropTurn = { readonly rotation: number; readonly flipH: boolean; readonly flipV: boolean }
const upright: CropTurn = { rotation: 0, flipH: false, flipV: false }

export function croppedBox(box: Box, before: unknown, after: unknown, turn = upright): Box | null {
  const was = rectOf(before)
  const next = rectOf(after)
  const across = side(box.x, box.cx, [was.l, was.r], [next.l, next.r])
  const down = side(box.y, box.cy, [was.t, was.b], [next.t, next.b])
  if (across === null || down === null || across.size <= 0 || down.size <= 0) return null
  const moveX = (across.at - box.x + (across.size - box.cx) / 2) * (turn.flipH ? -1 : 1)
  const moveY = (down.at - box.y + (down.size - box.cy) / 2) * (turn.flipV ? -1 : 1)
  const angle = (turn.rotation * Math.PI) / 180
  return {
    x: Math.round(box.x + (box.cx - across.size) / 2 + moveX * Math.cos(angle) - moveY * Math.sin(angle)),
    y: Math.round(box.y + (box.cy - down.size) / 2 + moveX * Math.sin(angle) + moveY * Math.cos(angle)),
    cx: across.size,
    cy: down.size,
  }
}

export function cropChange(view: ScopedElement, before: unknown, turn = upright): (value: unknown) => SetChange {
  return (value) => {
    const target = { node: view.node }
    const box = view.box === null ? null : croppedBox(view.box, before, value, turn)
    const fills = { crop: value, mode: "crop" } as SetChange["fills"]
    if (box === null) return { target, fills }
    return { target, fills, box: { x: box.x, y: box.y, w: box.cx, h: box.cy } }
  }
}

type Side = keyof Rect

type Point = { readonly x: number; readonly y: number }

export function draggedCrop(
  start: Rect,
  edges: readonly Side[],
  delta: Point,
  size: { readonly width: number; readonly height: number },
): Rect {
  const x = (delta.x * (whole - start.l - start.r)) / size.width
  const y = (delta.y * (whole - start.t - start.b)) / size.height
  const changes = { l: x, r: -x, t: y, b: -y }
  const opposite = { l: "r", r: "l", t: "b", b: "t" } satisfies Record<Side, Side>
  const next = { ...start }
  for (const edge of edges) {
    const limit = Math.max(start[edge], whole - start[opposite[edge]] - 1000)
    next[edge] = Math.max(0, Math.min(limit, Math.round(start[edge] + changes[edge])))
  }
  return next
}

export { rectOf as cropRect }
export type { Rect as CropRect }

export function cropTurn(
  fields: Readonly<Record<string, { readonly value: unknown } | undefined>> | undefined,
): CropTurn {
  const rot = fields?.["box.rot"]?.value
  return {
    rotation: typeof rot === "number" ? rot / 60_000 : 0,
    flipH: fields?.["box.flipH"]?.value === true,
    flipV: fields?.["box.flipV"]?.value === true,
  }
}
