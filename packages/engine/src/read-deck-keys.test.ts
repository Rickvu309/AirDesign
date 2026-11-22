import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, format, openRegister, type Command, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { readDeckPage } from "./index.js"

const node = elementId("258.7")
const stored = '[{"from":0,"lineSpacing":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]'

function landed(commands: readonly Command[]): Register {
  return commands.reduce(
    (register, command) => {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      return decision.register
    },
    openRegister("shell", "slide"),
  )
}

it("shows an agent a text a build before line height wrote under today's key, and leaves what is stored", () => {
  const parsed = readDeckId("deck")
  if (!parsed.ok) throw new Error(parsed.refusal)
  const register = landed([
    { command: "add", node, floor: "", route: "slide" },
    { command: "person", node, v: format, patch: { text: { value: { set: stored } } } },
  ])
  const read = readDeckPage({ id: parsed.deck, revision: 1, register }, { runId: null })
  const value = read.elements.find((element) => element.node === node)?.value
  expect(value).toBe('[{"from":0,"lineHeight":150000,"runs":[{"from":0,"text":"Quarterly plan"}]}]')
  expect(JSON.stringify(register.elements[node]?.landed)).toContain('\\"lineSpacing\\":150000')
})
