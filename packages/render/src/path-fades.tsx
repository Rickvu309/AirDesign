import type { Resolved } from "@airdesign/doom"
import type { ReactNode } from "react"

type Point = readonly [number, number]
type Arc = { readonly radii: Point; readonly end: Point; readonly direction: 1 | -1; readonly large: boolean }
type Span = { readonly start: number; readonly sweep: number }
type Wedge = {
  readonly node: Resolved
  readonly opacity: number
  readonly center: Point
  readonly outer: Point
  readonly inner: Point | undefined
  readonly span: Span
}

const turn = 2 * Math.PI
const pathTolerance = 0.005
const positive = (angle: number) => (angle + turn) % turn
const wedgePath = /^M([^A]+)((?:A[^ALZ]+){1,2})L([^AZ]+)((?:A[^AZ]+){0,2})Z$/

function point(text: string): Point | null {
  const [x, y, extra] = text.split(" ").map(Number)
  if (x === undefined || y === undefined || extra !== undefined || !Number.isFinite(x) || !Number.isFinite(y))
    return null
  return [x, y]
}

function arcs(text: string): Arc[] {
  const result: Arc[] = []
  for (const command of text.split("A").slice(1)) {
    const args = command.split(" ").map(Number)
    const [rx, ry, tilt, large, sweep, x, y] = args
    if (
      args.length !== 7 ||
      rx === undefined ||
      ry === undefined ||
      x === undefined ||
      y === undefined ||
      !args.every(Number.isFinite) ||
      rx <= 0 ||
      ry <= 0 ||
      tilt !== 0 ||
      (large !== 0 && large !== 1) ||
      (sweep !== 0 && sweep !== 1)
    )
      return []
    result.push({ radii: [rx, ry], end: [x, y], direction: sweep === 1 ? 1 : -1, large: large === 1 })
  }
  return result
}

function trace(start: Point, center: Point, segments: readonly Arc[]): Span | null {
  const first = segments[0]
  if (first === undefined) return null
  const [rx, ry] = first.radii
  const tolerance = pathTolerance / Math.min(rx, ry)
  const angleAt = ([x, y]: Point) => {
    const dx = (x - center[0]) / rx
    const dy = (y - center[1]) / ry
    return Math.abs(Math.hypot(dx, dy) - 1) <= tolerance ? Math.atan2(dy, dx) : null
  }
  const begin = angleAt(start)
  if (begin === null) return null
  let from = begin
  let sweep = 0
  for (const arc of segments) {
    if (arc.radii[0] !== rx || arc.radii[1] !== ry || arc.direction !== first.direction) return null
    const to = angleAt(arc.end)
    if (to === null) return null
    const step = positive((to - from) * arc.direction)
    const large = step > Math.PI
    if (step <= tolerance || (Math.abs(step - Math.PI) > tolerance && arc.large !== large)) return null
    sweep += step
    from = to
  }
  if (sweep >= turn - tolerance) return null
  return first.direction === 1 ? { start: positive(begin), sweep } : { start: positive(from), sweep }
}

function fadedWedge(node: Resolved): Wedge | null {
  const { geometry, fills } = node
  const paint = fills[0]
  if (
    geometry?.kind !== "path" ||
    !geometry.fillStroke ||
    fills.length !== 1 ||
    paint?.kind !== "solid" ||
    node.strokes.length > 0 ||
    node.effects.length > 0 ||
    node.children.length > 0 ||
    node.text !== null
  )
    return null
  const opacity = node.opacity * paint.opacity
  if (opacity <= 0 || opacity >= 1) return null

  const match = wedgePath.exec(geometry.d)
  if (match === null) return null
  const start = point(match[1]!)
  const outer = arcs(match[2]!)
  const join = point(match[3]!)
  const inside = arcs(match[4]!)
  const first = outer[0]
  const last = outer.at(-1)
  if (start === null || join === null || first === undefined || last === undefined) return null
  const inner = inside[0]
  if (inner === undefined) {
    const span = trace(start, join, outer)
    return match[4] === "" && span !== null
      ? { node, opacity, center: join, outer: first.radii, inner: undefined, span }
      : null
  }

  const [rx, ry] = first.radii
  const [ix, iy] = inner.radii
  const tolerance = pathTolerance / Math.min(rx, ry)
  if (ix >= rx || iy >= ry || Math.abs(ix / rx - iy / ry) > tolerance || inner.direction === first.direction)
    return null

  const [x, y] = last.end
  const center: Point = [x + (join[0] - x) / (1 - ix / rx), y + (join[1] - y) / (1 - iy / ry)]
  const span = trace(start, center, outer)
  const hole = trace(join, center, inside)
  if (span === null || hole === null || Math.abs(span.sweep - hole.sweep) > tolerance) return null
  const offset = positive(span.start - hole.start)
  if (Math.min(offset, turn - offset) > tolerance) return null
  return { node, opacity, center, outer: first.radii, inner: inner.radii, span }
}

function sameRing(a: Wedge, b: Wedge): boolean {
  const x = a.node.box
  const y = b.node.box
  return (
    a.opacity === b.opacity &&
    x.x === y.x &&
    x.y === y.y &&
    x.w === y.w &&
    x.h === y.h &&
    x.rotation === y.rotation &&
    x.flipH === y.flipH &&
    x.flipV === y.flipV &&
    a.outer[0] === b.outer[0] &&
    a.outer[1] === b.outer[1] &&
    a.inner?.[0] === b.inner?.[0] &&
    a.inner?.[1] === b.inner?.[1] &&
    Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) <= pathTolerance
  )
}

function joinWithoutOverlap(wedges: readonly Wedge[]): boolean {
  if (wedges.length < 2) return false
  const sorted = wedges.toSorted((a, b) => a.span.start - b.span.start)
  const tolerance = pathTolerance / Math.min(...sorted[0]!.outer)
  let joined = false
  for (const [index, { span }] of sorted.entries()) {
    const next = sorted[index + 1]?.span.start ?? sorted[0]!.span.start + turn
    const gap = next - span.start - span.sweep
    if (gap < -tolerance) return false
    if (gap <= tolerance) joined = true
  }
  return joined
}

export function paintPathFades(nodes: readonly Resolved[], render: (node: Resolved) => ReactNode): ReactNode[] {
  const painted: ReactNode[] = []
  let wedges: Wedge[] = []

  function flush() {
    if (joinWithoutOverlap(wedges)) {
      painted.push(
        <div key={`fade-${wedges[0]!.node.id}`} style={{ position: "absolute", inset: 0, opacity: wedges[0]!.opacity }}>
          {wedges.map(({ node }) =>
            render({ ...node, opacity: 1, fills: node.fills.map((fill) => ({ ...fill, opacity: 1 })) }),
          )}
        </div>,
      )
    } else {
      for (const { node } of wedges) painted.push(render(node))
    }
    wedges = []
  }

  for (const node of nodes) {
    const wedge = fadedWedge(node)
    if (wedge === null) {
      if (wedges.length > 0) flush()
      painted.push(render(node))
      continue
    }
    if (wedges[0] !== undefined && !sameRing(wedges[0], wedge)) flush()
    wedges.push(wedge)
  }
  if (wedges.length > 0) flush()
  return painted
}
