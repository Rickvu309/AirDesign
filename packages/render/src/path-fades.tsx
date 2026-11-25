import type { Resolved } from "@airdesign/doom"
import type { ReactNode } from "react"
import { type Point, type Polygon, convexPath, edgeTolerance, pathPoint, polygonPartition } from "./path-partitions.js"

type Arc = { readonly radii: Point; readonly end: Point; readonly direction: 1 | -1; readonly large: boolean }
type Span = { readonly start: number; readonly sweep: number }
type Wedge = {
  readonly kind: "wedge"
  readonly center: Point
  readonly outer: Point
  readonly inner: Point | undefined
  readonly span: Span
}

const turn = 2 * Math.PI
type Shape = Wedge | { readonly kind: "polygon"; readonly polygon: Polygon }
type Piece = {
  readonly node: Resolved
  readonly fill: string
  readonly d: string
  readonly opacity: number
  readonly shape: Shape
}

const positive = (angle: number) => (angle + turn) % turn
const wedgePath = /^M([^A]+)((?:A[^ALZ]+){1,2})L([^AZ]+)((?:A[^AZ]+){0,2})Z$/

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
  const tolerance = edgeTolerance / Math.min(rx, ry)
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

function wedgeOf(d: string): Wedge | null {
  const match = wedgePath.exec(d)
  if (match === null) return null
  const start = pathPoint(match[1]!)
  const outer = arcs(match[2]!)
  const join = pathPoint(match[3]!)
  const inside = arcs(match[4]!)
  const first = outer[0]
  const last = outer.at(-1)
  if (start === null || join === null || first === undefined || last === undefined) return null
  const inner = inside[0]
  if (inner === undefined) {
    const span = trace(start, join, outer)
    return match[4] === "" && span !== null
      ? { kind: "wedge", center: join, outer: first.radii, inner: undefined, span }
      : null
  }

  const [rx, ry] = first.radii
  const [ix, iy] = inner.radii
  const tolerance = edgeTolerance / Math.min(rx, ry)
  if (ix >= rx || iy >= ry || Math.abs(ix / rx - iy / ry) > tolerance || inner.direction === first.direction)
    return null

  const [x, y] = last.end
  const center: Point = [x + (join[0] - x) / (1 - ix / rx), y + (join[1] - y) / (1 - iy / ry)]
  const span = trace(start, center, outer)
  const hole = trace(join, center, inside)
  if (span === null || hole === null || Math.abs(span.sweep - hole.sweep) > tolerance) return null
  const offset = positive(span.start - hole.start)
  if (Math.min(offset, turn - offset) > tolerance) return null
  return { kind: "wedge", center, outer: first.radii, inner: inner.radii, span }
}

function pieceOf(node: Resolved): Piece | null {
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
  if (opacity <= 0) return null
  const base = { node, fill: paint.color, d: geometry.d, opacity }
  const wedge = wedgeOf(geometry.d)
  if (wedge !== null) return { ...base, shape: wedge }
  const polygon = convexPath(geometry.d)
  return polygon === null ? null : { ...base, shape: { kind: "polygon", polygon } }
}

function sameBox(x: Resolved["box"], y: Resolved["box"]): boolean {
  return (
    x.x === y.x &&
    x.y === y.y &&
    x.w === y.w &&
    x.h === y.h &&
    x.rotation === y.rotation &&
    x.flipH === y.flipH &&
    x.flipV === y.flipV
  )
}

function samePartition(a: Piece, b: Piece): boolean {
  if (!sameBox(a.node.box, b.node.box)) return false
  const x = a.shape
  const y = b.shape
  if (x.kind === "polygon") return y.kind === "polygon"
  return (
    y.kind === "wedge" &&
    x.outer[0] === y.outer[0] &&
    x.outer[1] === y.outer[1] &&
    x.inner?.[0] === y.inner?.[0] &&
    x.inner?.[1] === y.inner?.[1] &&
    Math.hypot(x.center[0] - y.center[0], x.center[1] - y.center[1]) <= edgeTolerance
  )
}

function canJoin(pieces: readonly Piece[]): boolean {
  const first = pieces[0]?.shape
  if (pieces.length < 2 || first === undefined) return false
  if (first.kind === "polygon")
    return polygonPartition(pieces.flatMap(({ shape }) => (shape.kind === "polygon" ? [shape.polygon] : [])))
  return joinWithoutOverlap(pieces.flatMap(({ shape }) => (shape.kind === "wedge" ? [shape] : [])))
}

function joinWithoutOverlap(wedges: readonly Wedge[]): boolean {
  if (wedges.length < 2) return false
  const sorted = wedges.toSorted((a, b) => a.span.start - b.span.start)
  const tolerance = edgeTolerance / Math.min(...sorted[0]!.outer)
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
  let pieces: Piece[] = []

  function paintJoined(run: readonly Piece[]): boolean {
    const first = run[0]
    if (first === undefined || run.every(({ opacity }) => opacity === 1) || !canJoin(run)) return false
    const { x, y, w, h, rotation, flipH, flipV } = first.node.box
    const levels = Array.from(new Set(run.map(({ opacity }) => opacity))).sort((a, b) => a - b)
    const ordered = levels.length === 2 ? run.toSorted((a, b) => b.opacity - a.opacity) : run
    painted.push(
      <svg
        key={`partition-${first.node.id}`}
        aria-hidden
        width={w}
        height={h}
        style={{
          position: "absolute",
          left: x,
          top: y,
          overflow: "visible",
          pointerEvents: "none",
          transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
        }}
      >
        {levels.map((level, i) => (
          <g key={level} opacity={1 - (1 - level) / (1 - (levels[i - 1] ?? 0))}>
            {ordered
              .filter(({ opacity }) => opacity >= level)
              .map(({ node, d, fill }) => (
                <path key={node.id} d={d} fill={fill} stroke={fill} strokeWidth={2} strokeLinejoin="round" />
              ))}
          </g>
        ))}
      </svg>,
      ...run.map(({ node }) => render({ ...node, fills: [] })),
    )
    return true
  }

  function flush() {
    if (!paintJoined(pieces)) {
      let start = 0
      for (let end = 1; end <= pieces.length; end += 1) {
        if (pieces[end]?.opacity === pieces[start]?.opacity) continue
        const run = pieces.slice(start, end)
        if (!paintJoined(run)) for (const { node } of run) painted.push(render(node))
        start = end
      }
    }
    pieces = []
  }

  for (const node of nodes) {
    const piece = pieceOf(node)
    if (piece === null) {
      flush()
      painted.push(render(node))
      continue
    }
    const first = pieces[0]
    if (first !== undefined && !samePartition(first, piece)) flush()
    pieces.push(piece)
  }
  flush()
  return painted
}
