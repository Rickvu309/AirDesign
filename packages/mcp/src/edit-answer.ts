import type { WireChange } from "@airdesign/catalog"
import { currentValue, version, type ElementId, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { editSentence, type EditCode } from "./edit-next.js"

export type EditElement = {
  readonly node: ElementId
  readonly value: string
  readonly version: number
  readonly closed?: true
}

export type EditAnswer =
  | { readonly ok: true; readonly revision: number; readonly elements: readonly EditElement[] }
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
    const held = { node, value: currentValue(body), version: version(body) }
    if (body.phase === "running" && body.guarded) return { ...held, closed: true }
    return held
  })
}

function answerBlock(answer: EditAnswer): { readonly type: "text"; readonly text: string } {
  return { type: "text", text: JSON.stringify(answer) }
}

export function editLanded(deck: Deck, nodes: readonly ElementId[]): EditResult {
  const answer: EditAnswer = { ok: true, revision: deck.revision, elements: heldElements(deck.register, nodes) }
  return {
    ok: true,
    deck,
    answer,
    content: [{ type: "text", text: `Landed revision ${String(deck.revision)}.` }, answerBlock(answer)],
  }
}

export function editRefusal(deck: Deck, code: EditCode, nodes: readonly ElementId[], detail?: string): EditResult {
  const elements = heldElements(deck.register, nodes)
  const answer: EditAnswer = { ok: false, revision: deck.revision, refusal: code, elements }
  const lead = { type: "text" as const, text: editSentence(code) }
  const content = detail === undefined ? [lead] : [lead, { type: "text" as const, text: detail }]
  return { ok: false, refusal: code, deck, answer, content: [...content, answerBlock(answer)] }
}
