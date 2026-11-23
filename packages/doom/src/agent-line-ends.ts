import type { AgentChange } from "./agent-change.js"
import type { AgentEnd } from "./agent-end.js"
import { type Draft, living, stop } from "./agent-draft.js"
import type { Node } from "./doom.js"
import { boxOf, get, slideOf } from "./doom-walk.js"
import type { End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import type { Point } from "./resolved.js"

type Line = Extract<Geometry, { kind: "line" }>
type Site = Extract<End, { node: NodeId }>["site"]

const sites = { top: "t", right: "r", bottom: "b", left: "l", center: "c" } as const

function centerOf(draft: Draft, id: NodeId): Point {
  let x = 0
  let y = 0
  let at: Node | undefined = draft.doom.nodes.get(id)
  const own = at === undefined ? null : boxOf(at)
  while (at !== undefined && at.type !== "slide") {
    const box = boxOf(at)
    x += box.x
    y += box.y
    const parent = (at as { parent?: { id: NodeId } | null }).parent
    at = parent == null ? undefined : draft.doom.nodes.get(parent.id)
  }
  return { x: x + (own?.w ?? 0) / 2, y: y + (own?.h ?? 0) / 2 }
}

function spotOf(draft: Draft, end: End): Point {
  return "x" in end ? end : centerOf(draft, end.node)
}

function facing(from: Point, to: Point): Site {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return "c"
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "r" : "l") : dy >= 0 ? "b" : "t"
}

type Owner = { readonly self: NodeId | null; readonly slide: NodeId | undefined }

function endOf(draft: Draft, owner: Owner, asked: AgentEnd, other: End, field: "from" | "to"): End {
  if ("x" in asked) return { x: asked.x, y: asked.y }
  const target = living(draft, asked.layer, field)
  const held = target.type === "shape" || target.type === "frame"
  if (!held || target.id === owner.self || get(target, "geometry")?.kind === "line") stop("shape", target.id, field)
  if (slideOf(draft.doom, target.id) !== owner.slide) stop("shape", target.id, field)
  const site = asked.side === undefined ? facing(centerOf(draft, target.id), spotOf(draft, other)) : sites[asked.side]
  return { node: target.id, site }
}

export function lineEnds(
  draft: Draft,
  owner: Owner,
  geometry: Line,
  change: Pick<Extract<AgentChange, { op: "set" }>, "from" | "to">,
): Pick<Line, "start" | "end"> {
  const toward: End =
    change.to === undefined ? geometry.end : "x" in change.to ? change.to : { node: change.to.layer, site: "c" }
  const start = change.from === undefined ? geometry.start : endOf(draft, owner, change.from, toward, "from")
  const end = change.to === undefined ? geometry.end : endOf(draft, owner, change.to, start, "to")
  return { start, end }
}
