import type { WireDiagram } from "@airdesign/catalog"
import {
  decide,
  groupOf,
  nextElementId,
  outlineOf,
  placeNewBox,
  route,
  sitePoint,
  slideMeasure,
  type Box,
  type ElementId,
  type Register,
  type SetChange,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { decided, ready, takenBoxes } from "./agent-elements.js"
import { applySet, openedRegister, type Applied } from "./apply-change.js"
import { applyPattern } from "./agent-pattern.js"
import type { Deck } from "./call.js"

const dead: Applied = { ok: false, refusal: "dead" }
const rect = outlineOf(null, {})
const upright = { rot: 0, flipH: false, flipV: false }
const right = 3
const left = 1
const arrowWidth = 25_400

function areaFor(register: Register, slide: SlideId, wanted: Box | undefined): Box | null {
  if (wanted !== undefined) return wanted
  const size = slideMeasure(register, slide)?.size
  if (size === undefined) return null
  const share = { cx: Math.round(size.width * 0.8), cy: Math.round(size.height * 0.25) }
  return placeNewBox(size, takenBoxes(register, slide), share)
}

export function labelBoxes(area: Box, count: number): readonly Box[] {
  const width = Math.floor((area.cx * 4) / (count * 5 - 1))
  const gap = Math.floor(width / 4)
  const height = Math.min(area.cy, Math.round(width * 0.6))
  const y = area.y + Math.round((area.cy - height) / 2)
  return Array.from({ length: count }, (_, at) => ({ x: area.x + at * (width + gap), y, cx: width, cy: height }))
}

function arrowBox(from: Box, to: Box): Box {
  const start = rect === null ? null : sitePoint({ box: from, ...upright }, rect, right)
  const end = rect === null ? null : sitePoint({ box: to, ...upright }, rect, left)
  if (start === null || end === null) throw new Error("site")
  return route({ box: from, ...upright }, start, end).box
}

type Built = { readonly register: Register; readonly node: ElementId }

function added(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  edit: (node: ElementId) => SlideCommand,
  change: (node: ElementId) => Omit<SetChange, "target">,
  runId: string,
): Built | Applied {
  const measure = slideMeasure(register, slide)
  if (measure === undefined) return dead
  const node = nextElementId(register, slide, measure.free)
  const done = decided(register, file, { ...edit(node), runId }, runId)
  if (!done.ok) return done
  const opened = openedRegister(done.register, { node })
  if (!opened.ok) return opened
  const started = decide(opened.register, { command: "start", runId, node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  const set = applySet(started.register, { target: { node }, ...change(node) }, runId)
  return set.ok ? { register: set.register, node } : set
}

function labelChange(words: string): Omit<SetChange, "target"> {
  return {
    geometry: { shape: { preset: "roundRect", adjust: {} } },
    fills: { paint: { solid: { scheme: "accent1" } } },
    body: { anchor: "ctr" },
    text: { value: words, align: "center", color: { scheme: "lt1" } },
  }
}

function arrowChange(from: ElementId, to: ElementId): Omit<SetChange, "target"> {
  return {
    connection: { start: { shape: { node: from, site: right } }, end: { shape: { node: to, site: left } } },
    border: {
      fill: { solid: { scheme: "accent1" } },
      width: arrowWidth,
      tail: { type: "triangle", width: "med", length: "med" },
    },
  }
}

export function applyDiagram(deck: Deck, change: WireDiagram, runId: string, base: number): Applied {
  const { slide } = change
  const labels = change.labels ?? []
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const area = areaFor(deck.register, slide, change.box)
  if (area === null) return dead
  if (change.pattern !== undefined && change.pattern !== "flow") return applyPattern(deck, change, area, runId, base)
  const boxes = labelBoxes(area, labels.length)
  let register = deck.register
  const shapes: ElementId[] = []
  for (const [at, words] of labels.entries()) {
    const box = boxes[at]
    if (box === undefined) return dead
    const element = (node: ElementId) => ({ node, kind: "shape", value: "", box, grouped: false }) as const
    const built = added(
      register,
      opened.file,
      slide,
      (node) => ({ slide: "element-add", id: slide, element: element(node) }),
      () => labelChange(words),
      runId,
    )
    if ("ok" in built) return built
    register = built.register
    shapes.push(built.node)
  }
  const arrows: ElementId[] = []
  for (const [at, from] of shapes.slice(0, -1).entries()) {
    const to = shapes[at + 1]
    const [fromBox, toBox] = [boxes[at], boxes[at + 1]]
    if (to === undefined || fromBox === undefined || toBox === undefined) return dead
    const box = arrowBox(fromBox, toBox)
    const element = (node: ElementId) => ({ node, kind: "connector", value: null, box, grouped: false }) as const
    const built = added(
      register,
      opened.file,
      slide,
      (node) => ({ slide: "element-add", id: slide, element: element(node), geometry: "line" }),
      () => arrowChange(from, to),
      runId,
    )
    if ("ok" in built) return built
    register = built.register
    arrows.push(built.node)
  }
  const measure = slideMeasure(register, slide)
  if (measure === undefined) return dead
  const group = groupOf(register, slide, nextElementId(register, slide, measure.free), [...shapes, ...arrows])
  if (group === null) return dead
  return decided(register, opened.file, { ...group, runId }, runId)
}
