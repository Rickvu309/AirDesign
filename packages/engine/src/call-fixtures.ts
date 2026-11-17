import type { SlideOp } from "@airdesign/catalog"
import { decide, type Register, type ElementId } from "@airdesign/document"
import { call, type Caller, type Deck } from "./call.js"
export function nodeBody(register: Register, id: ElementId) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

export function include(register: Register, id: ElementId): Register {
  if (register.nodes.includes(id)) return register
  const added = decide(register, { command: "add", node: id, floor: register.floor, route: register.route })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}

type Changed = { readonly deck: string; readonly base: number } & Readonly<Record<string, unknown>>

export function changeCall(op: SlideOp | "delete" | "add", deck: Deck, caller: Caller, raw: Changed) {
  const { deck: id, base, ...change } = raw
  return call("edit_deck", deck, caller, { deck: id, base, changes: [{ op, ...change }] })
}
