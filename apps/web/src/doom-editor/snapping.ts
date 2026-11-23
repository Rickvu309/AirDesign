export type Bounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

type Axis = "x" | "y"

export type Line = "start" | "middle" | "end"

type SnapGuide = {
  readonly kind: "snap"
  readonly axis: Axis
  readonly at: number
  readonly from: number
  readonly to: number
  readonly marks: readonly number[]
}

type SpacingGuide = {
  readonly kind: "spacing"
  readonly axis: Axis
  readonly from: number
  readonly to: number
  readonly across: number
}

export type Guide = SnapGuide | SpacingGuide

type GuideLines = { readonly x: readonly number[]; readonly y: readonly number[] }

export type SnapTargets = { readonly layers: readonly Bounds[]; readonly slide: Bounds; readonly guides?: GuideLines }

type Snapped = { readonly box: Bounds; readonly guides: readonly Guide[] }

type Watched = { readonly x: readonly Line[]; readonly y: readonly Line[]; readonly spacing: boolean }

type Span = { readonly start: number; readonly end: number }

type Touch = { readonly box: Bounds; readonly line: Line; readonly marked: boolean }

export const snapReach = 4.5

const tolerance = 1

const lines: readonly Line[] = ["start", "middle", "end"]

const everyLine: Watched = { x: lines, y: lines, spacing: true }

export function reachOf(width: number, slideWidth: number): number {
  return (snapReach * slideWidth) / width
}

function spanOf(box: Bounds, axis: Axis): Span {
  return axis === "x" ? { start: box.left, end: box.right } : { start: box.top, end: box.bottom }
}

function crossOf(axis: Axis): Axis {
  return axis === "x" ? "y" : "x"
}

function lineOf(span: Span, line: Line): number {
  if (line === "start") return span.start
  if (line === "end") return span.end
  return (span.start + span.end) / 2
}

function moved(box: Bounds, axis: Axis, by: number): Bounds {
  return axis === "x"
    ? { ...box, left: box.left + by, right: box.right + by }
    : { ...box, top: box.top + by, bottom: box.bottom + by }
}

function goalsOf(targets: SnapTargets, axis: Axis): readonly number[] {
  const boxes = [...targets.layers, targets.slide].flatMap((box) =>
    lines.map((line) => lineOf(spanOf(box, axis), line)),
  )
  return [...boxes, ...(targets.guides?.[axis] ?? [])]
}

function nearest(offsets: readonly number[], reach: number): number | null {
  let best: number | null = null
  for (const offset of offsets) {
    if (Math.abs(offset) <= reach && (best === null || Math.abs(offset) < Math.abs(best))) best = offset
  }
  return best === null ? null : Math.round(best)
}

function overlapping(left: Span, right: Span): boolean {
  return left.start < right.end && left.end > right.start
}

function rowOf(box: Bounds, layers: readonly Bounds[], axis: Axis): readonly Bounds[] {
  const cross = crossOf(axis)
  return layers.filter((layer) => overlapping(spanOf(layer, cross), spanOf(box, cross)))
}

function before(row: readonly Bounds[], edge: number, axis: Axis, not?: Bounds): Bounds | undefined {
  let found: Bounds | undefined
  for (const layer of row) {
    const end = spanOf(layer, axis).end
    if (layer !== not && end <= edge && (found === undefined || end > spanOf(found, axis).end)) found = layer
  }
  return found
}

function after(row: readonly Bounds[], edge: number, axis: Axis, not?: Bounds): Bounds | undefined {
  let found: Bounds | undefined
  for (const layer of row) {
    const start = spanOf(layer, axis).start
    if (layer !== not && start >= edge && (found === undefined || start < spanOf(found, axis).start)) found = layer
  }
  return found
}

function spacingOffsets(box: Bounds, layers: readonly Bounds[], axis: Axis, reach: number): readonly number[] {
  const own = spanOf(box, axis)
  const row = rowOf(box, layers, axis)
  const left = before(row, own.start + reach, axis)
  const right = after(row, own.end - reach, axis, left)
  const offsets: number[] = []
  if (left !== undefined && right !== undefined) {
    const room = spanOf(right, axis).start - spanOf(left, axis).end - (own.end - own.start)
    if (room >= 0) offsets.push(spanOf(left, axis).end + room / 2 - own.start)
  }
  const further = left === undefined ? undefined : before(row, spanOf(left, axis).start, axis, left)
  if (left !== undefined && further !== undefined) {
    const gap = spanOf(left, axis).start - spanOf(further, axis).end
    offsets.push(spanOf(left, axis).end + gap - own.start)
  }
  const beyond = right === undefined ? undefined : after(row, spanOf(right, axis).end, axis, right)
  if (right !== undefined && beyond !== undefined) {
    const gap = spanOf(beyond, axis).start - spanOf(right, axis).end
    offsets.push(spanOf(right, axis).start - gap - own.end)
  }
  return offsets
}

function lineOffsets(box: Bounds, targets: SnapTargets, axis: Axis, watched: readonly Line[]): readonly number[] {
  const goals = goalsOf(targets, axis)
  const own = spanOf(box, axis)
  return watched.flatMap((line) => goals.map((goal) => goal - lineOf(own, line)))
}

function marksOf(touch: Touch, cross: Axis): readonly number[] {
  if (!touch.marked) return []
  const span = spanOf(touch.box, cross)
  return touch.line === "middle" ? [(span.start + span.end) / 2] : [span.start, span.end]
}

function lineGuides(box: Bounds, targets: SnapTargets, axis: Axis, watched: readonly Line[]): readonly SnapGuide[] {
  const cross = crossOf(axis)
  const others = [
    ...targets.layers.map((layer) => ({ box: layer, marked: true })),
    { box: targets.slide, marked: false },
  ]
  const guides: SnapGuide[] = []
  for (const line of watched) {
    const at = lineOf(spanOf(box, axis), line)
    if (guides.some((guide) => Math.abs(guide.at - at) <= tolerance)) continue
    const hits = others.flatMap((other) =>
      lines
        .filter((each) => Math.abs(lineOf(spanOf(other.box, axis), each) - at) <= tolerance)
        .map((each): Touch => ({ ...other, line: each })),
    )
    if (hits.length === 0) continue
    const touched: readonly Touch[] = [{ box, line, marked: true }, ...hits]
    const ends = touched.flatMap((touch) => [spanOf(touch.box, cross).start, spanOf(touch.box, cross).end])
    const marks = [...new Set(touched.flatMap((touch) => marksOf(touch, cross)))].sort((left, right) => left - right)
    guides.push({ kind: "snap", axis, at, from: Math.min(...ends), to: Math.max(...ends), marks })
  }
  return guides
}

function middleAcross(left: Bounds, right: Bounds, cross: Axis): number {
  const one = spanOf(left, cross)
  const two = spanOf(right, cross)
  const start = Math.max(one.start, two.start)
  const end = Math.min(one.end, two.end)
  if (start < end) return (start + end) / 2
  return (one.start + one.end + two.start + two.end) / 4
}

function spacingGuides(box: Bounds, layers: readonly Bounds[], axis: Axis): readonly SpacingGuide[] {
  const own = spanOf(box, axis)
  const row = rowOf(box, layers, axis)
  const left = before(row, own.start + tolerance, axis)
  const right = after(row, own.end - tolerance, axis, left)
  const leftGap = left === undefined ? 0 : own.start - spanOf(left, axis).end
  const rightGap = right === undefined ? 0 : spanOf(right, axis).start - own.end
  const pairs: [Bounds, Bounds][] = []
  const same = (one: number, two: number) => one > tolerance && Math.abs(one - two) <= tolerance
  if (left !== undefined && right !== undefined && same(leftGap, rightGap)) pairs.push([left, box], [box, right])
  const further = left === undefined ? undefined : before(row, spanOf(left, axis).start + tolerance, axis, left)
  if (left !== undefined && further !== undefined) {
    if (same(leftGap, spanOf(left, axis).start - spanOf(further, axis).end)) pairs.push([further, left], [left, box])
  }
  const beyond = right === undefined ? undefined : after(row, spanOf(right, axis).end - tolerance, axis, right)
  if (right !== undefined && beyond !== undefined) {
    if (same(rightGap, spanOf(beyond, axis).start - spanOf(right, axis).end)) pairs.push([box, right], [right, beyond])
  }
  const guides: SpacingGuide[] = []
  for (const [one, two] of pairs) {
    const from = spanOf(one, axis).end
    const to = spanOf(two, axis).start
    if (guides.some((guide) => guide.from === from && guide.to === to)) continue
    guides.push({ kind: "spacing", axis, from, to, across: middleAcross(one, two, crossOf(axis)) })
  }
  return guides.sort((one, two) => one.from - two.from)
}

export function guidesAt(box: Bounds, targets: SnapTargets, watched: Watched): readonly Guide[] {
  return [
    ...lineGuides(box, targets, "x", watched.x),
    ...lineGuides(box, targets, "y", watched.y),
    ...(watched.spacing
      ? [...spacingGuides(box, targets.layers, "x"), ...spacingGuides(box, targets.layers, "y")]
      : []),
  ]
}

export function snapMove(box: Bounds, targets: SnapTargets, reach: number): Snapped {
  const offset = (axis: Axis) =>
    nearest([...lineOffsets(box, targets, axis, lines), ...spacingOffsets(box, targets.layers, axis, reach)], reach) ??
    0
  const snapped = moved(moved(box, "x", offset("x")), "y", offset("y"))
  return { box: snapped, guides: guidesAt(snapped, targets, everyLine) }
}

type LineSnap = { readonly line: Line; readonly offset: number }

export function lineAt(box: Bounds, axis: Axis, line: Line): number {
  return lineOf(spanOf(box, axis), line)
}

export function nearestLine(
  box: Bounds,
  targets: SnapTargets,
  axis: Axis,
  watched: readonly Line[],
  reach: number,
): LineSnap | null {
  let best: LineSnap | null = null
  for (const line of watched) {
    const offset = nearest(lineOffsets(box, targets, axis, [line]), reach)
    if (offset !== null && (best === null || Math.abs(offset) < Math.abs(best.offset))) best = { line, offset }
  }
  return best
}
