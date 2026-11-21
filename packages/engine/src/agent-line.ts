import type { WireAdd, WireSet } from "@airdesign/catalog"
import {
  decide,
  nextElementId,
  placeOf,
  registerScope,
  routed,
  shapeOf,
  siteKinds,
  siteTie,
  slideMeasure,
  type Box,
  type Place,
  type Register,
  type SetChange,
  type SlideId,
  type Tie,
} from "@airdesign/document"
import { decided, ready } from "./agent-elements.js"
import { applySet, openedRegister, type Applied } from "./apply-change.js"
import type { Deck } from "./call.js"

export type WireLine = Extract<WireAdd, { readonly kind: "line" | "arrow" | "elbow" }>

export function drawsLine(edit: WireSet | WireAdd): edit is WireLine {
  return edit.op === "add" && (edit.kind === "line" || edit.kind === "arrow" || edit.kind === "elbow")
}

type End = NonNullable<NonNullable<WireLine["connection"]>["start"]>

const upright = { rot: 0, flipH: false, flipV: false }

const drawn = { line: "line", arrow: "straightConnector1", elbow: "bentConnector3" } as const

function tieOf(register: Register, slide: SlideId, end: End | undefined): Tie | null | "site" {
  if (end === undefined || !("shape" in end)) return null
  const { node, site } = end.shape
  if (shapeOf(node).slide !== slide) return "site"
  const view = registerScope(register).view(node)
  const place = placeOf(register, node)
  const outline = view?.outline
  if (view === undefined || outline == null || place === null || !siteKinds.includes(view.facts.kind)) return "site"
  if ((view.parent ?? null) !== null) return "site"
  return siteTie(place, outline, site) ?? "site"
}

function linePlace(register: Register, change: WireLine, preset: string): Place | null {
  const start = tieOf(register, change.slide, change.connection?.start)
  const end = tieOf(register, change.slide, change.connection?.end)
  if (start === "site" || end === "site") return null
  const spot = start?.spot ?? end?.spot
  const box: Box | undefined = change.box ?? (spot === undefined ? undefined : { x: spot.x, y: spot.y, cx: 0, cy: 0 })
  if (box === undefined) return null
  const place = { box, ...upright }
  return routed(place, preset, {}, start, end)?.place ?? place
}

export function addLine(deck: Deck, change: WireLine, runId: string, base: number): Applied {
  const { register } = deck
  const opened = ready({ deck: deck.id, base }, deck, change.slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, change.slide)
  if (measure === undefined) return { ok: false, refusal: "dead" }
  const geometry = drawn[change.kind]
  const place = linePlace(register, change, geometry)
  if (place === null) return { ok: false, refusal: "site" }
  const node = nextElementId(register, change.slide, measure.free)
  const element = { node, kind: "connector", value: null, box: place.box, grouped: false } as const
  const edit = { slide: "element-add", id: change.slide, element, geometry, runId } as const
  const added = decided(register, opened.file, edit, runId)
  if (!added.ok) return added
  const { rot, flipH, flipV } = place
  const turned = rot !== 0 || flipH || flipV ? { box: { ...(rot === 0 ? {} : { rot }), flipH, flipV } } : {}
  const rows: Omit<SetChange, "target"> = {
    ...(change.connection === undefined ? {} : { connection: change.connection }),
    ...(change.border === undefined ? {} : { border: change.border }),
    ...turned,
  }
  if (Object.keys(rows).length === 0) return added
  const started = openedRegister(added.register, { node })
  if (!started.ok) return started
  const running = decide(started.register, { command: "start", runId, node })
  if (running.decision === "refuse") return { ok: false, refusal: running.code }
  return applySet(running.register, { target: { node }, ...rows }, runId)
}
