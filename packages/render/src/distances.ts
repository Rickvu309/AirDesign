import type { Axis, Bounds } from "./snapping.js"

export type Distance = {
  readonly kind: "distance"
  readonly axis: Axis
  readonly from: number
  readonly to: number
  readonly across: number
}

export type Extension = {
  readonly kind: "extension"
  readonly axis: Axis
  readonly at: number
  readonly from: number
  readonly to: number
}

export type Outline = { readonly kind: "outline"; readonly box: Bounds }

export type Measure = Distance | Extension | Outline

type Span = { readonly start: number; readonly end: number }

const axes: readonly Axis[] = ["x", "y"]

function spanOf(box: Bounds, axis: Axis): Span {
  return axis === "x" ? { start: box.left, end: box.right } : { start: box.top, end: box.bottom }
}

function crossOf(axis: Axis): Axis {
  return axis === "x" ? "y" : "x"
}

function middle(span: Span): number {
  return (span.start + span.end) / 2
}

function shared(one: Span, two: Span): Span | null {
  const start = Math.max(one.start, two.start)
  const end = Math.min(one.end, two.end)
  return start < end ? { start, end } : null
}

function distance(axis: Axis, one: number, two: number, across: number): readonly Distance[] {
  if (one === two) return []
  return [{ kind: "distance", axis, from: Math.min(one, two), to: Math.max(one, two), across }]
}

function gap(
  axis: Axis,
  from: number,
  to: number,
  across: number,
  edge: number,
  reach: Span | null,
): readonly Measure[] {
  const line = distance(axis, from, to, across)
  if (reach === null || line.length === 0) return line
  const near = across < reach.start ? reach.start : reach.end
  return [...line, { kind: "extension", axis: crossOf(axis), at: edge, from: across, to: near }]
}

function along(selected: Bounds, target: Bounds, axis: Axis): readonly Measure[] {
  const own = spanOf(selected, axis)
  const other = spanOf(target, axis)
  const ownCross = spanOf(selected, crossOf(axis))
  const otherCross = spanOf(target, crossOf(axis))
  const both = shared(ownCross, otherCross)
  const across = middle(both ?? ownCross)
  const reach = both === null ? otherCross : null
  if (other.start >= own.end) return gap(axis, own.end, other.start, across, other.start, reach)
  if (other.end <= own.start) return gap(axis, other.end, own.start, across, other.end, reach)
  if (both === null) return []
  return [...distance(axis, own.start, other.start, across), ...distance(axis, own.end, other.end, across)]
}

export function measured(selected: Bounds, target: Bounds): readonly Measure[] {
  return [{ kind: "outline", box: target }, ...axes.flatMap((axis) => along(selected, target, axis))]
}
