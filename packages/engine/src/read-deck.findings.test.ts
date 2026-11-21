import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { readDeckPage, type Deck } from "./index.js"

const title = elementId("258.7")
const other = elementId("259.2")

function deck(): Deck {
  let register: Register = openRegister("shell", "slide")
  const commands: readonly Command[] = [
    { command: "add", node: title, floor: "", route: "slide" },
    { command: "person", node: title, value: "Before" },
    { command: "add", node: other, floor: "", route: "slide" },
    { command: "person", node: other, value: "Other" },
  ]
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return { id: id.deck, revision: 7, register }
}

it("lists the findings a tab reported, with a fix to send, only while the deck is still at that revision", () => {
  const read = deck()
  const overflow = { code: "overflow", node: title, needed: 86.4, room: 64.8, size: 28, height: 93.6 } as const
  const report = { deck: read.id, revision: 7, findings: [overflow] }
  expect(readDeckPage(read, { runId: null, findings: report }).findings).toEqual([
    {
      code: "overflow",
      node: title,
      measure: "text 86.4 pt, room 64.8",
      fix: { op: "set", target: title, text: { size: 28 } },
    },
  ])
  expect(readDeckPage(read, { runId: null, slide: "259", findings: report }).findings).toEqual([])
  expect(readDeckPage(read, { runId: null, findings: { ...report, revision: 6 } }).findings).toBe("pending 7")
  const broken = { ...report, findings: [], broken: true } as const
  expect(readDeckPage(read, { runId: null, findings: broken }).findings).toBe("broken 7")
  expect(readDeckPage(read, { runId: null }).findings).toBe("missing")
})
