import type { CallRefusal, WireAdd, WireRunElement, WireSet } from "@airdesign/catalog"
import {
  decide,
  limits,
  openingElement,
  planChange,
  shapeOf,
  slideKind,
  slideBirths,
  registerScope,
  themeNode,
  valueBytes,
  version,
  type ElementId,
  type Register,
  type Row,
  type SetChange,
} from "@airdesign/document"
import { addIcon, addTextBox } from "./agent-elements.js"
import { readFresh } from "./agent-slides.js"
import type { Deck } from "./call.js"

export type Applied =
  | { readonly ok: true; readonly register: Register }
  | { readonly ok: false; readonly refusal: CallRefusal }

function slideOwned(register: Register, node: ElementId): boolean {
  if (node === themeNode) return true
  if (slideKind(node) === null) return false
  const slide = shapeOf(node).slide
  return (
    register.index?.slides.some((each) => each.id === slide) === true ||
    register.order.some((command) => slideBirths(command).some((birth) => birth.id === slide))
  )
}

export function openedRegister(register: Register, edit: WireRunElement): Applied {
  if (register.nodes.includes(edit.node)) return { ok: true, register }
  const index = register.index
  if (
    index !== undefined &&
    index.elements.length === index.total &&
    openingElement(register, edit.node) === undefined &&
    !slideOwned(register, edit.node)
  )
    return { ok: false, refusal: "dead" }
  const opened = decide(register, {
    command: "add",
    node: edit.node,
    floor: edit.floor ?? register.floor,
    route: register.route,
  })
  if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
  return { ok: true, register: opened.register }
}

export function landRow(register: Register, node: ElementId, row: Row, runId: string): Applied {
  const bytes = valueBytes(row)
  if (bytes > limits.valueBytes) return { ok: false, refusal: "limit" }
  const opened = openedRegister(register, { node })
  if (!opened.ok) return opened
  const body = opened.register.elements[node]
  const next = opened.register.bytes + bytes
  if (body === undefined || next >= limits.bytes) return { ok: false, refusal: "limit" }
  const decision = decide(opened.register, { command: "agent", runId, readAt: version(body), node, ...row })
  if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
  return { ok: true, register: { ...decision.register, bytes: next } }
}

export function applySet(register: Register, change: SetChange, runId: string): Applied {
  const planned = planChange(change, registerScope(register))
  if (!planned.ok) return { ok: false, refusal: planned.refusals[0]?.code ?? "dead" }
  let current = register
  for (const { node, row } of planned.rows) {
    const landed = landRow(current, node, row, runId)
    if (!landed.ok) return landed
    current = landed.register
  }
  return { ok: true, register: current }
}

function addedNode(register: Register): ElementId | undefined {
  const last = register.order.at(-1)
  return last?.slide === "element-add" ? last.element.node : undefined
}

function applyAdd(deck: Deck, change: WireAdd, runId: string, base: number): Applied {
  if (change.kind === "picture")
    return addIcon({ deck: deck.id, base }, deck, change.slide, change.icon, change.box, runId)
  const added = addTextBox({ deck: deck.id, base }, deck, change.slide, change.box, runId)
  if (!added.ok) return added
  const node = addedNode(added.register)
  if (change.text === undefined || node === undefined) return added
  const opened = openedRegister(added.register, { node })
  if (!opened.ok) return opened
  const started = decide(opened.register, { command: "start", runId, node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  return applySet(started.register, { target: { node }, text: change.text }, runId)
}

export function applyAgentChange(deck: Deck, change: WireSet | WireAdd, runId: string, base: number): Applied {
  if (!readFresh(deck, runId, base)) return { ok: false, refusal: "stale" }
  return change.op === "set" ? applySet(deck.register, change, runId) : applyAdd(deck, change, runId, base)
}
