import type { Intent } from "./intent-read.js"
import type { IntentEnd } from "./intent-end.js"
import { type Draft, living, stop } from "./intent-draft.js"
import type { Node } from "./doom.js"
import { boxOf } from "./doom-walk.js"
import type { Channel, End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { holdsLineEnd } from "./line-end-holder.js"
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

export function spanOfEnds(
  draft: Draft,
  parent: Node,
  intent: Pick<Extract<Intent, { op: "set" }>, "from" | "to">,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | undefined {
  if (intent.from === undefined || intent.to === undefined) return undefined
  const inside = parent.type === "slide" ? { x: 0, y: 0 } : centerOf(draft, parent.id)
  const own = parent.type === "slide" ? { w: 0, h: 0 } : boxOf(parent)
  const spot = (end: IntentEnd): Point =>
    "x" in end
      ? end
      : {
          x: centerOf(draft, end.layer).x - inside.x + own.w / 2,
          y: centerOf(draft, end.layer).y - inside.y + own.h / 2,
        }
  const [one, two] = [spot(intent.from), spot(intent.to)]
  const x = Math.min(one.x, two.x)
  const y = Math.min(one.y, two.y)
  return { x, y, w: Math.abs(one.x - two.x), h: Math.abs(one.y - two.y) }
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

function endOf(draft: Draft, owner: Owner, asked: IntentEnd, other: End, field: "from" | "to"): End {
  if ("x" in asked) return { x: asked.x, y: asked.y }
  const target = living(draft, asked.layer, field)
  if (!holdsLineEnd(draft.doom, target.id, owner.self, owner.slide))
    stop("shape", target.id, field, "form", { code: "line-attachment" })
  const site = asked.side === undefined ? facing(centerOf(draft, target.id), spotOf(draft, other)) : sites[asked.side]
  return { node: target.id, site, ...(asked.along === undefined || site === "c" ? {} : { along: asked.along }) }
}

export function laneOf(start: End, end: End, lane: number): readonly Channel[] {
  const site = "node" in start && start.site !== "c" ? start.site : "node" in end && end.site !== "c" ? end.site : "t"
  return [{ axis: site === "t" || site === "b" ? "y" : "x", at: lane }]
}

export function lineEnds(
  draft: Draft,
  owner: Owner,
  geometry: Line,
  intent: Pick<Extract<Intent, { op: "set" }>, "from" | "to">,
): Pick<Line, "start" | "end"> {
  const toward: End =
    intent.to === undefined ? geometry.end : "x" in intent.to ? intent.to : { node: intent.to.layer, site: "c" }
  const start = intent.from === undefined ? geometry.start : endOf(draft, owner, intent.from, toward, "from")
  const end = intent.to === undefined ? geometry.end : endOf(draft, owner, intent.to, start, "to")
  return { start, end }
}
