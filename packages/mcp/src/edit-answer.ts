import type { WireChange } from "@airdesign/catalog"
import { currentBox, currentValue, version, type Box, type ElementId, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { editNext, runNext, type EditCode } from "./edit-next.js"

export type EditElement = {
  readonly node: ElementId
  readonly value: string
  readonly version: number
  readonly box?: Box
  readonly closed?: true
}

export type EditAnswer =
  | {
      readonly ok: true
      readonly revision: number
      readonly runId: string
      readonly elements: readonly EditElement[]
    }
  | {
      readonly ok: false
      readonly revision: number
      readonly refusal: EditCode
      readonly elements: readonly EditElement[]
    }

export type EditResult =
  | {
      readonly ok: true
      readonly deck: Deck
      readonly content: readonly { readonly type: "text"; readonly text: string }[]
      readonly answer: EditAnswer
    }
  | {
      readonly ok: false
      readonly refusal: EditCode
      readonly deck: Deck
      readonly content: readonly { readonly type: "text"; readonly text: string }[]
      readonly answer: EditAnswer
    }

export function namedNodes(changes: readonly WireChange[]): ElementId[] {
  const nodes: ElementId[] = []
  for (const change of changes) {
    if (!nodes.includes(change.node)) nodes.push(change.node)
  }
  return nodes
}

export function heldElements(register: Register, nodes: readonly ElementId[]): EditElement[] {
  return nodes.map((node) => {
    const body = register.nodes.includes(node) ? register.elements[node] : undefined
    if (body === undefined) return { node, value: "", version: 0 }
    const box = currentBox(body)
    const value = { node, value: currentValue(body), version: version(body) }
    const held = box === null ? value : { ...value, box }
    if (body.phase === "running" && body.guarded) return { ...held, closed: true }
    return held
  })
}

function answerBlock(answer: EditAnswer): { readonly type: "text"; readonly text: string } {
  return { type: "text", text: JSON.stringify(answer) }
}

function landedResult(deck: Deck, lead: string, runId: string, nodes: readonly ElementId[]): EditResult {
  const answer: EditAnswer = { ok: true, revision: deck.revision, runId, elements: heldElements(deck.register, nodes) }
  return { ok: true, deck, answer, content: [{ type: "text", text: lead }, answerBlock(answer)] }
}

export function editLanded(deck: Deck, nodes: readonly ElementId[], runId: string): EditResult {
  return landedResult(deck, `Landed revision ${String(deck.revision)}.`, runId, nodes)
}

export function runEnded(deck: Deck, runId: string): EditResult {
  return landedResult(deck, `Stopped the run at revision ${String(deck.revision)}.`, runId, [])
}

function refusedResult(
  deck: Deck,
  code: EditCode,
  sentence: string,
  nodes: readonly ElementId[],
  detail?: string,
): EditResult {
  const elements = heldElements(deck.register, nodes)
  const answer: EditAnswer = { ok: false, revision: deck.revision, refusal: code, elements }
  const lead = { type: "text" as const, text: sentence }
  const content = detail === undefined ? [lead] : [lead, { type: "text" as const, text: detail }]
  return { ok: false, refusal: code, deck, answer, content: [...content, answerBlock(answer)] }
}

export function editRefusal(deck: Deck, code: EditCode, nodes: readonly ElementId[], detail?: string): EditResult {
  return refusedResult(deck, code, editNext[code], nodes, detail)
}

export function runRefusal(deck: Deck, code: EditCode): EditResult {
  return refusedResult(deck, code, runNext[code], [])
}
