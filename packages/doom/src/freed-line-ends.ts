import type { Author, Doom, Node, Write } from "./doom.js"
import { boxOf, onDeck, parentOf, propOf, slideOf } from "./doom-walk.js"
import type { End } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { lineRoute } from "./line-ends.js"
import { linesBack, lostEnds, type LostEnds } from "./lost-ends.js"
import type { Measure } from "./measure.js"
import type { Box, Point } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"
import { applyBeforeFreeing } from "./apply-edit.js"
import { rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import { onTop } from "./view-of.js"

const sweeper: Author = { kind: "person", id: "line-ends" }

type Matrix = readonly [number, number, number, number, number, number]
const identity: Matrix = [1, 0, 0, 1, 0, 0]

function turned(box: Box): Matrix {
  const radians = (box.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const x = box.x + box.w / 2
  const y = box.y + box.h / 2
  return [cos, sin, -sin, cos, x - cos * (box.w / 2) + sin * (box.h / 2), y - sin * (box.w / 2) - cos * (box.h / 2)]
}

function times([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix {
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f]
}

function placeOf(doom: Doom, boxes: () => ReadonlyMap<NodeId, Box>, id: NodeId): Matrix {
  if (doom.nodes.get(id)?.type === "slide") return identity
  const chain: Node[] = []
  let at: Node | undefined = doom.nodes.get(id)
  for (let hops = 0; at !== undefined && at.type !== "slide" && hops <= doom.nodes.size; hops += 1) {
    chain.unshift(at)
    const parent = parentOf(at)
    at = parent == null ? undefined : doom.nodes.get(parent.id)
  }
  const laid = boxes()
  return chain.reduce((matrix, node) => times(matrix, turned(boxOf(node, laid))), identity)
}

const onSlide = ([a, b, c, d, e, f]: Matrix, at: Point): Point => ({
  x: a * at.x + c * at.y + e,
  y: b * at.x + d * at.y + f,
})

function inside([a, b, c, d, e, f]: Matrix, at: Point): Point {
  const det = a * d - b * c
  const x = at.x - e
  const y = at.y - f
  const settle = (value: number) => Math.round(value * 1e6) / 1e6
  return { x: settle((d * x - c * y) / det), y: settle((a * y - b * x) / det) }
}

export const mayLeaveDeck = (before: Doom, writes: readonly Write[]): boolean =>
  writes.some((write) => {
    if (write.prop !== "parent" || !before.nodes.has(write.node)) return false
    const parent = write.value as { readonly id: NodeId } | null
    return parent === null || !onDeck(before.nodes, parent.id)
  })

const namesOffDeck = (before: Doom, value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  [(value as { start?: unknown }).start, (value as { end?: unknown }).end].some(
    (end) => typeof end === "object" && end !== null && "node" in end && !onDeck(before.nodes, end.node as NodeId),
  )

const mayDrawOffDeck = (before: Doom, writes: readonly Write[]): boolean =>
  writes.some((write) => write.prop === "geometry" && namesOffDeck(before, write.value))

const mayBringBack = (before: Doom, writes: readonly Write[]): boolean =>
  writes.some(
    (write) =>
      write.prop === "parent" &&
      write.value !== null &&
      before.nodes.has(write.node) &&
      !onDeck(before.nodes, write.node),
  )

function paintedBack(last: Doom, after: Doom, lines: readonly NodeId[]): readonly LostEnds[] {
  const back: LostEnds[] = []
  for (const line of lines) {
    const now = propOf(after.nodes.get(line), "geometry")
    if (now?.kind !== "line" || !onDeck(last.nodes, line)) continue
    const dead = (end: End) => ("node" in end && !onDeck(after.nodes, end.node) ? end.node : null)
    const [start, end] = [dead(now.start), dead(now.end)]
    if (start === null && end === null) continue
    if ([start, end].every((shape) => shape === null || onDeck(last.nodes, shape))) back.push({ line, start, end })
  }
  return back
}

function paintedEnds(into: Doom, writes: readonly Write[], measure: Measure): readonly Write[] {
  const drawn = new Set(
    writes.flatMap((write) => (write.prop === "parent" || write.prop === "geometry" ? [write.node] : [])),
  )
  const freed: Write[] = []
  for (const line of drawn) {
    const now = propOf(into.nodes.get(line), "geometry")
    const parent = parentOf(into.nodes.get(line))
    const slide = slideOf(into, line)
    if (now?.kind !== "line" || parent == null || slide === undefined) continue
    const dead = (end: End) => "node" in end && !onDeck(into.nodes, end.node)
    if (!dead(now.start) && !dead(now.end)) continue
    const route = lineRoute(into, solveLayout(into, slide, measure), parent.id, now)
    const base = writes.find((write) => write.node === line && write.prop === "geometry")?.base
    freed.push({
      node: line,
      prop: "geometry",
      value: { ...now, start: dead(now.start) ? route.from : now.start, end: dead(now.end) ? route.to : now.end },
      ...(base === undefined ? {} : { base }),
    })
  }
  return freed
}

export function freedEnds(seen: Doom, into: Doom, lost: readonly LostEnds[], measure: Measure): readonly Write[] {
  const laid = new Map<Doom, Map<NodeId, ReadonlyMap<NodeId, Box>>>()
  const layout = (doom: Doom, slide: NodeId) => {
    const slides = laid.get(doom) ?? new Map<NodeId, ReadonlyMap<NodeId, Box>>()
    laid.set(doom, slides)
    const known = slides.get(slide) ?? solveLayout(doom, slide, measure)
    slides.set(slide, known)
    return known
  }
  const freed: Write[] = []
  for (const { line, start, end } of lost) {
    const read = propOf(seen.nodes.get(line), "geometry")
    const now = propOf(into.nodes.get(line), "geometry")
    const was = parentOf(seen.nodes.get(line))
    const parent = parentOf(into.nodes.get(line))
    const slide = slideOf(seen, line)
    const slideNow = slideOf(into, line)
    if (read?.kind !== "line" || now?.kind !== "line" || was == null || parent == null) continue
    if (slide === undefined || slideNow === undefined) continue
    const boxes = layout(seen, slide)
    const route = lineRoute(seen, boxes, was.id, read)
    const from = placeOf(seen, () => boxes, was.id)
    const to = placeOf(into, () => layout(into, slideNow), parent.id)
    const point = (at: Point) => inside(to, onSlide(from, at))
    const live = (at: End, lost: NodeId) => "node" in at && at.node !== lost && onDeck(into.nodes, at.node)
    freed.push({
      node: line,
      prop: "geometry",
      value: {
        ...now,
        start: start === null || live(now.start, start) ? now.start : point(route.from),
        end: end === null || live(now.end, end) ? now.end : point(route.to),
      },
    })
  }
  return freed
}

function leftBy(before: Doom, writes: readonly Write[]): { readonly after: Doom; readonly lost: readonly LostEnds[] } {
  if (!mayLeaveDeck(before, writes) && !mayDrawOffDeck(before, writes) && !mayBringBack(before, writes))
    return { after: before, lost: [] }
  const edit = onTop(before, {
    once: "free-line-ends",
    author: sweeper,
    writes,
  })
  const after = applyBeforeFreeing(before, { ...edit, rev: rev(before.rev + 1) })
  return isRefusal(after) ? { after: before, lost: [] } : { after, lost: lostEnds(before.nodes, after.nodes, writes) }
}

export const lostBy = (before: Doom, writes: readonly Write[]): readonly LostEnds[] => leftBy(before, writes).lost

export function freeLineEnds(
  before: Doom,
  writes: readonly Write[],
  measure: Measure,
  seen: Doom = before,
  last: Doom = before,
): readonly Write[] {
  const { after, lost } = leftBy(before, writes)
  if (after === before) return writes
  const losing = new Set(lost.map((each) => each.line))
  const back = paintedBack(last, after, linesBack(before.nodes, after.nodes, writes)).filter(
    (each) => !losing.has(each.line),
  )
  const freeing = new Set([...losing, ...back.map((each) => each.line)])
  const freed = [
    ...freedEnds(seen, after, lost, measure),
    ...freedEnds(last, after, back, measure),
    ...paintedEnds(after, writes, measure).filter((write) => !freeing.has(write.node)),
  ]
  if (freed.length === 0) return writes
  const replaced = new Set(freed.map((write) => write.node))
  const kept = writes.filter((write) => write.prop !== "geometry" || !replaced.has(write.node))
  return [...kept, ...freed]
}
