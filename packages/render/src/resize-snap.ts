import type { Box, ElementId } from "@airdesign/document"
import type { Point } from "./box-gesture.js"
import type { DragSnap } from "./drag-snap.js"
import {
  around,
  boundsOf,
  guidesAt,
  lineAt,
  nearestLine,
  reachOf,
  type Axis,
  type Bounds,
  type Line,
  type LineSnap,
  type Watched,
} from "./snapping.js"
import type { SnappedResult, TransformDragInput, TransformResult } from "./transform-drag.js"

export type Evaluate = (input: TransformDragInput) => TransformResult

type Reading = { readonly result: TransformResult; readonly bounds: Bounds }

type Pull = { readonly axis: Axis; readonly line: Line; readonly goal: number; readonly slope: Point }

type Row = { readonly slope: Point; readonly by: number; readonly pulled: boolean }

const axes: readonly Axis[] = ["x", "y"]

const edges: readonly Line[] = ["start", "end"]

const probe = 1

const stillShare = 0.01

const parallelSine = 0.01

const landed = 2

function boundsAround(boxes: ReadonlyMap<ElementId, Box>, turns: ReadonlyMap<ElementId, number>): Bounds | null {
  return around([...boxes].map(([id, box]) => boundsOf(box, turns.get(id) ?? 0)))
}

function readAt(input: TransformDragInput, evaluate: Evaluate, turns: DragSnap["turns"], at: Point): Reading | null {
  const result = evaluate({ ...input, at })
  const bounds = boundsAround(result.boxes, turns)
  return bounds === null ? null : { result, bounds }
}

function slopeOf(base: Bounds, across: Bounds, down: Bounds, axis: Axis, line: Line): Point {
  const now = lineAt(base, axis, line)
  return { x: (lineAt(across, axis, line) - now) / probe, y: (lineAt(down, axis, line) - now) / probe }
}

function lengthOf(point: Point): number {
  return Math.hypot(point.x, point.y)
}

function rowTravel(row: Row): Point {
  const square = row.slope.x * row.slope.x + row.slope.y * row.slope.y
  return square === 0 ? { x: 0, y: 0 } : { x: (row.slope.x * row.by) / square, y: (row.slope.y * row.by) / square }
}

function travelFor(rows: readonly Row[]): Point {
  const [first, second] = rows
  if (first === undefined) return { x: 0, y: 0 }
  if (second === undefined) return rowTravel(first)
  const turn = first.slope.x * second.slope.y - first.slope.y * second.slope.x
  if (Math.abs(turn) <= parallelSine * lengthOf(first.slope) * lengthOf(second.slope)) {
    const nearer = !second.pulled || (first.pulled && Math.abs(first.by) <= Math.abs(second.by)) ? first : second
    return rowTravel(nearer)
  }
  return {
    x: (first.by * second.slope.y - second.by * first.slope.y) / turn,
    y: (first.slope.x * second.by - second.slope.x * first.by) / turn,
  }
}

function shifted(at: Point, by: Point): Point {
  return { x: at.x + by.x, y: at.y + by.y }
}

function alignedTo(bounds: Bounds, pulls: readonly Pull[]): Bounds {
  let aligned = bounds
  for (const pull of pulls) {
    const miss = pull.goal - lineAt(aligned, pull.axis, pull.line)
    if (pull.axis === "x") {
      aligned = {
        ...aligned,
        left: pull.line === "end" ? aligned.left : aligned.left + miss,
        right: pull.line === "start" ? aligned.right : aligned.right + miss,
      }
    } else {
      aligned = {
        ...aligned,
        top: pull.line === "end" ? aligned.top : aligned.top + miss,
        bottom: pull.line === "start" ? aligned.bottom : aligned.bottom + miss,
      }
    }
  }
  return aligned
}

function held(reading: Reading, pulls: readonly Pull[]): boolean {
  return pulls.every((pull) => Math.abs(lineAt(reading.bounds, pull.axis, pull.line) - pull.goal) <= landed)
}

export function snappedResize(input: TransformDragInput, evaluate: Evaluate, snap: DragSnap): SnappedResult {
  const base = readAt(input, evaluate, snap.turns, input.at)
  const across = readAt(input, evaluate, snap.turns, shifted(input.at, { x: probe, y: 0 }))
  const down = readAt(input, evaluate, snap.turns, shifted(input.at, { x: 0, y: probe }))
  if (base === null || across === null || down === null) return { ...evaluate(input), guides: [] }
  const still = (stillShare * input.slide.width) / input.width
  const moving = (axis: Axis) =>
    edges.filter((line) => lengthOf(slopeOf(base.bounds, across.bounds, down.bounds, axis, line)) >= still)
  const watched: Watched = { x: moving("x"), y: moving("y"), spacing: false }
  const reach = reachOf(input.width, input.slide.width)
  const pulls = axes.flatMap((axis): Pull[] => {
    const found: LineSnap | null = nearestLine(base.bounds, snap, axis, watched[axis], reach)
    if (found === null) return []
    const slope = slopeOf(base.bounds, across.bounds, down.bounds, axis, found.line)
    return [{ axis, line: found.line, goal: lineAt(base.bounds, axis, found.line) + found.offset, slope }]
  })
  if (pulls.length === 0) return { ...base.result, guides: [] }
  const holds = axes.flatMap((axis): Pull[] => {
    if (pulls.some((pull) => pull.axis === axis)) return []
    const steepest = watched[axis]
      .map((line) => ({ line, slope: slopeOf(base.bounds, across.bounds, down.bounds, axis, line) }))
      .sort((one, two) => lengthOf(two.slope) - lengthOf(one.slope))[0]
    if (steepest === undefined) return []
    return [{ axis, line: steepest.line, goal: lineAt(base.bounds, axis, steepest.line), slope: steepest.slope }]
  })
  const rowsAt = (reading: Reading): readonly Row[] =>
    [...pulls, ...holds].map((pull) => ({
      slope: pull.slope,
      by: pull.goal - lineAt(reading.bounds, pull.axis, pull.line),
      pulled: pulls.includes(pull),
    }))
  const firstAt = shifted(input.at, travelFor(rowsAt(base)))
  const first = readAt(input, evaluate, snap.turns, firstAt)
  if (first === null) return { ...base.result, guides: [] }
  const second = readAt(input, evaluate, snap.turns, shifted(firstAt, travelFor(rowsAt(first))))
  const settled = second !== null && held(second, pulls) ? second : held(first, pulls) ? first : null
  if (settled === null) return { ...base.result, guides: [] }
  const reached = pulls.filter((pull) => Math.abs(lineAt(settled.bounds, pull.axis, pull.line) - pull.goal) <= landed)
  return { ...settled.result, guides: guidesAt(alignedTo(settled.bounds, reached), snap, watched) }
}
