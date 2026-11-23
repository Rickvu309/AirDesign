import type { Box, ScopedElement, SetChange } from "@airdesign/document"
import { placedFrame } from "@airdesign/render"

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

export type CropTurn = { readonly rotation: number; readonly flipH: boolean; readonly flipV: boolean }

const upright: CropTurn = { rotation: 0, flipH: false, flipV: false }

export function croppedBox(box: Box, before: unknown, after: unknown, turn: CropTurn = upright): Box | null {
  const was = rectOf(before)
  const next = rectOf(after)
  const across = side(0, box.cx, [was.l, was.r], [next.l, next.r])
  const down = side(0, box.cy, [was.t, was.b], [next.t, next.b])
  if (across === null || down === null || across.size <= 0 || down.size <= 0) return null
  const placed = placedFrame(
    { x: box.x, y: box.y, width: box.cx, height: box.cy, ...turn },
    { x: across.at, y: down.at, width: across.size, height: down.size },
  )
  return { x: placed.x, y: placed.y, cx: placed.width, cy: placed.height }
}

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

export function cropChange(
  view: ScopedElement,
  before: unknown,
  turn: CropTurn = upright,
): (value: unknown) => SetChange {
  return (value) => {
    const target = { node: view.node }
    const box = view.box === null ? null : croppedBox(view.box, before, value, turn)
    const fills = { crop: value, mode: "crop" } as SetChange["fills"]
    if (box === null) return { target, fills }
    return { target, fills, box: { x: box.x, y: box.y, w: box.cx, h: box.cy } }
  }
}
