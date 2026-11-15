import type { WireGroup } from "@airdesign/catalog"
import {
  decide,
  format,
  groupOf,
  nextElementId,
  readSlideId,
  shapeOf,
  slideMeasure,
  ungroupRows,
  type ElementId,
  type Register,
  type Row,
} from "@airdesign/document"
import { decided, ready } from "./agent-elements.js"
import { landRow, openedRegister, type Applied } from "./apply-change.js"
import type { Deck } from "./call.js"

const dead: Applied = { ok: false, refusal: "dead" }

function landStarted(register: Register, node: ElementId, row: Row, runId: string): Applied {
  const opened = openedRegister(register, { node })
  if (!opened.ok) return opened
  const body = opened.register.elements[node]
  if (body?.phase === "running" && body.runId === runId) return landRow(opened.register, node, row, runId)
  const started = decide(opened.register, { command: "start", runId, node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  return landRow(started.register, node, row, runId)
}

function grouped(deck: Deck, elements: readonly ElementId[], runId: string, base: number): Applied {
  const slides = new Set(elements.map((node) => shapeOf(node).slide))
  const slide = slides.size === 1 ? readSlideId([...slides][0]) : undefined
  if (slide === undefined) return dead
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(deck.register, slide)
  if (measure === undefined) return dead
  const command = groupOf(deck.register, slide, nextElementId(deck.register, slide, measure.free), elements)
  if (command === null) return dead
  return decided(deck.register, opened.file, { ...command, runId }, runId)
}

function ungrouped(deck: Deck, group: ElementId, runId: string, base: number): Applied {
  const slide = readSlideId(shapeOf(group).slide)
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened || slide === undefined)
    return "refusal" in opened ? { ok: false, refusal: opened.refusal } : dead
  const rows = ungroupRows(deck.register, group) ?? []
  const done = decided(deck.register, opened.file, { slide: "element-ungroup", id: slide, node: group, runId }, runId)
  if (!done.ok) return done
  let register = done.register
  for (const row of rows) {
    const landed = landStarted(register, row.node, { v: format, patch: row.patch }, runId)
    if (!landed.ok) return landed
    register = landed.register
  }
  return { ok: true, register }
}

export function applyGroup(deck: Deck, change: WireGroup, runId: string, base: number): Applied {
  if (change.op === "group") return grouped(deck, change.elements, runId, base)
  let register = deck.register
  for (const group of change.elements) {
    const applied = ungrouped({ ...deck, register }, group, runId, base)
    if (!applied.ok) return applied
    register = applied.register
  }
  return { ok: true, register }
}
