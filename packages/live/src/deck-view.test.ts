import {
  currentBox,
  currentValue,
  decide,
  elementId,
  format,
  openRegister,
  type Command,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { readStored, rowsFromRegister, view } from "./deck-view.js"
import type { DeckId } from "@airdesign/catalog"

const deck = "deck" as DeckId
const node = elementId("258.7")
const box = { x: 10, y: 20, cx: 30, cy: 40 }

function applied(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

function agentRows(): Register {
  const element = { node, kind: "shape" as const, value: "file", box, grouped: false }
  const register = { ...openRegister("", deck), index: { total: 1, slides: [], elements: [element], pages: [] } }
  return applied(register, [
    { command: "add", node, floor: "", route: deck },
    { command: "start", runId: "run", node },
    { command: "agent", runId: "run", readAt: 0, node, v: format, patch: { box: { x: { set: 5 } } } },
    { command: "agent", runId: "run", readAt: 1, node, v: format, patch: { text: { value: { set: "set" } } } },
  ])
}

it("keeps an agent's row of trait fields as one confirmed row and plays it back on the device", () => {
  const rows = rowsFromRegister(deck, agentRows())
  expect(rows).toEqual([
    { kind: "confirmed", deck, revision: 0, node, v: format, patch: { box: { x: { set: 5 } } }, floor: "file" },
    { kind: "confirmed", deck, revision: 1, node, v: format, patch: { text: { value: { set: "set" } } } },
  ])
  const index = agentRows().index
  const played = view(deck, rows).register
  const body = played.elements[node]
  if (body === undefined) throw new Error("node")
  expect(currentValue(body)).toBe("set")
  expect(index === undefined ? null : currentBox(body)).toBeNull()
})

it("reads a stored row through the stored reader and names a row from a newer build", () => {
  const row = { kind: "confirmed" as const, deck, revision: 0, node, v: format, patch: { box: { x: { set: 5 } } } }
  expect(readStored(row)).toEqual({ ok: true, value: row })
  const unread = { ...row, patch: JSON.parse('{"box":{"spin":{"set":5}}}') as typeof row.patch }
  expect(readStored(unread)).toEqual({ ok: false, refusal: "payload" })
  expect(readStored({ ...row, v: format + 1 })).toEqual({ ok: false, refusal: "newer" })
  const typed = { kind: "confirmed" as const, deck, revision: 0, node, value: "typed" }
  expect(readStored(typed)).toEqual({ ok: true, value: typed })
})
