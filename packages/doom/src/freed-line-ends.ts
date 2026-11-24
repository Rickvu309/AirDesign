import type { Doom, Write } from "./doom.js"
import { descendantsOf, parentOf, propOf, slideOf } from "./doom-walk.js"
import type { End } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { lineRoute } from "./line-ends.js"
import type { Measure } from "./measure.js"
import { solveLayout } from "./solve-layout.js"

function held(doom: Doom, end: End, gone: ReadonlySet<NodeId>): boolean {
  return "node" in end && gone.has(end.node) && parentOf(doom.nodes.get(end.node)) != null
}

export function freedLineEnds(doom: Doom, roots: readonly NodeId[], measure: Measure): readonly Write[] {
  const gone = new Set<NodeId>()
  for (const root of roots) {
    if (!doom.nodes.has(root)) continue
    gone.add(root)
    for (const child of descendantsOf(doom, root)) gone.add(child.id)
  }
  if (gone.size === 0) return []
  const laid = new Map<NodeId, ReturnType<typeof solveLayout>>()
  const layout = (slide: NodeId) => {
    const known = laid.get(slide)
    if (known !== undefined) return known
    const next = solveLayout(doom, slide, measure)
    laid.set(slide, next)
    return next
  }
  const writes: Write[] = []
  for (const node of doom.nodes.values()) {
    if (gone.has(node.id)) continue
    const geometry = propOf(node, "geometry")
    if (geometry?.kind !== "line") continue
    const parent = propOf(node, "parent")
    if (parent == null) continue
    const startGone = held(doom, geometry.start, gone)
    const endGone = held(doom, geometry.end, gone)
    if (!startGone && !endGone) continue
    const slide = slideOf(doom, node.id)
    if (slide === undefined) continue
    const route = lineRoute(doom, layout(slide), parent.id, geometry)
    writes.push({
      node: node.id,
      prop: "geometry",
      value: {
        ...geometry,
        start: startGone ? { x: route.from.x, y: route.from.y } : geometry.start,
        end: endGone ? { x: route.to.x, y: route.to.y } : geometry.end,
      },
    })
  }
  return writes
}
