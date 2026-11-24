import type { Author, Doom, Node, Write } from "./doom.js"
import { boxOf, onDeck, parentOf, propOf, slideOf } from "./doom-walk.js"
import type { End } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { lineRoute } from "./line-ends.js"
import type { Measure } from "./measure.js"
import type { Box, Point } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"
import { viewOf } from "./view-of.js"

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

export function freedLineEnds(before: Doom, writes: readonly Write[], measure: Measure): readonly Write[] {
  if (!mayLeaveDeck(before, writes)) return []
  const after = viewOf(before, [{ once: "free-line-ends", author: sweeper, writes }])
  if (after === before) return []
  const lost = (end: End): boolean => "node" in end && onDeck(before.nodes, end.node) && !onDeck(after.nodes, end.node)
  const laid = new Map<Doom, Map<NodeId, ReadonlyMap<NodeId, Box>>>()
  const layout = (doom: Doom, slide: NodeId) => {
    const slides = laid.get(doom) ?? new Map<NodeId, ReadonlyMap<NodeId, Box>>()
    laid.set(doom, slides)
    const known = slides.get(slide) ?? solveLayout(doom, slide, measure)
    slides.set(slide, known)
    return known
  }
  const freed: Write[] = []
  for (const line of after.nodes.values()) {
    const geometry = propOf(line, "geometry")
    if (geometry?.kind !== "line") continue
    const startLost = lost(geometry.start)
    const endLost = lost(geometry.end)
    if (!startLost && !endLost) continue
    const was = parentOf(before.nodes.get(line.id))
    const now = parentOf(line)
    const slide = slideOf(before, line.id)
    const slideNow = slideOf(after, line.id)
    if (was == null || now == null || slide === undefined || slideNow === undefined) continue
    if (!onDeck(before.nodes, line.id) || !onDeck(after.nodes, line.id)) continue
    const boxes = layout(before, slide)
    const route = lineRoute(before, boxes, was.id, geometry)
    const from = placeOf(before, () => boxes, was.id)
    const to = placeOf(after, () => layout(after, slideNow), now.id)
    const point = (at: Point) => inside(to, onSlide(from, at))
    const base = before.revs.get(line.id)?.get("geometry")
    freed.push({
      node: line.id,
      prop: "geometry",
      value: {
        ...geometry,
        start: startLost ? point(route.from) : geometry.start,
        end: endLost ? point(route.to) : geometry.end,
      },
      ...(base === undefined ? {} : { base }),
    })
  }
  return freed
}
