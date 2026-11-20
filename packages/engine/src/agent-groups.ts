import type { WireGroup } from "@airdesign/catalog"
import {
  changeLayout,
  cloneOf,
  currentBox,
  decide,
  elementId,
  format,
  groupOf,
  nextElementId,
  openingElement,
  readSlideId,
  shapeOf,
  slideMeasure,
  ungroupRows,
  type ElementId,
  type Command,
  type Register,
  type Row,
  type SlideId,
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

function framed(deck: Deck, elements: readonly ElementId[], runId: string, base: number): Applied {
  const slides = new Set(elements.map((node) => shapeOf(node).slide))
  const slide = slides.size === 1 ? readSlideId([...slides][0]) : undefined
  if (slide === undefined) return dead
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(deck.register, slide)
  if (measure === undefined) return dead
  const node = nextElementId(deck.register, slide, measure.free)
  const backdrop = elementId(`${slide}.${String(Number(shapeOf(node).shape) + 1)}`)
  const changed = changeLayout(deck.register, { wrap: elements, slide, node, backdrop })
  if (changed === null || !("slide" in changed)) return dead
  return decided(deck.register, opened.file, { ...changed.slide, runId }, runId)
}

function turned(register: Register, file: readonly SlideId[], turn: readonly Command[], runId: string): Applied {
  let current = register
  for (const command of turn) {
    const landed =
      command.command === "slide"
        ? decided(current, file, { ...command.edit, runId }, runId)
        : command.command === "person" && command.node !== undefined && command.v !== undefined
          ? landStarted(current, command.node, { v: command.v, patch: command.patch }, runId)
          : dead
    if (!landed.ok) return landed
    current = landed.register
  }
  return { ok: true, register: current }
}

function moved(
  deck: Deck,
  layers: readonly ElementId[],
  frame: ElementId | null,
  runId: string,
  base: number,
): Applied {
  const named = layers[0] ?? frame
  const slide = named === undefined || named === null ? undefined : readSlideId(shapeOf(named).slide)
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  let register = deck.register
  for (const layer of layers) {
    const changed = changeLayout(register, { move: layer, frame, file: opened.file })
    if (changed === null || !("turn" in changed)) return dead
    const applied = turned(register, opened.file, changed.turn, runId)
    if (!applied.ok) return applied
    register = applied.register
  }
  return { ok: true, register }
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

function duplicated(deck: Deck, elements: readonly ElementId[], runId: string, base: number): Applied {
  let register = deck.register
  for (const source of elements) {
    const slide = readSlideId(shapeOf(source).slide)
    const opened = ready({ deck: deck.id, base }, deck, slide, runId)
    if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
    const measure = slide === undefined ? undefined : slideMeasure(register, slide)
    const body = register.elements[source]
    const box = (body === undefined ? null : currentBox(body)) ?? openingElement(register, source)?.box ?? null
    if (slide === undefined || measure === undefined || box === null) return dead
    const cloned = cloneOf(register, source, nextElementId(register, slide, measure.free), box)
    if (!cloned.ok) return { ok: false, refusal: cloned.refusal }
    const landed = decided(register, opened.file, { ...cloned.command, runId }, runId)
    if (!landed.ok) return landed
    register = landed.register
  }
  return { ok: true, register }
}

export function applyGroup(deck: Deck, change: WireGroup, runId: string, base: number): Applied {
  if (change.op === "duplicate") return duplicated(deck, change.elements, runId, base)
  if (change.op === "group") return grouped(deck, change.elements, runId, base)
  if (change.op === "frame") return framed(deck, change.elements, runId, base)
  const [first, ...rest] = change.elements
  if (change.op === "join") return first === undefined ? dead : moved(deck, rest, first, runId, base)
  if (change.op === "leave") return moved(deck, change.elements, null, runId, base)
  let register = deck.register
  for (const group of change.elements) {
    const applied = ungrouped({ ...deck, register }, group, runId, base)
    if (!applied.ok) return applied
    register = applied.register
  }
  return { ok: true, register }
}
