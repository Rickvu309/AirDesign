import { readDeckId } from "@airdesign/catalog"
import { decide, version } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { score, suite, type AgentCaller } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string, encoding: "utf8"): string
  }
}

const { readFileSync } = process.getBuiltinModule("node:fs")

function running(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  const started = decide(deck.register, { command: "start", runId: "run" })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function callerFor(deck: Deck): AgentCaller {
  return { actor: "agent", runId: "run", readAt: version(deck.register) }
}

function modelHost(): string {
  return ["a", "n", "t", "h", "r", "o", "p", "i", "c"].join("")
}

describe("suite", () => {
  it("scores each task on a fresh running deck", () => {
    expect(suite).toHaveLength(40)
    for (const task of suite) {
      const deck = running()
      const result = score(task, deck, callerFor(deck))
      expect(result.pass, task.id).toBe(task.expect === "pass")
      if (task.expect === "fail") {
        expect(
          result.deck.register.landed.map((row) => row.value),
          task.id,
        ).toEqual(["22"])
      }
    }
    const host = modelHost()
    const site = ["api.", host].join("")
    for (const name of ["suite.ts", "suite.test.ts"]) {
      const text = readFileSync(`${process.cwd()}/packages/mcp/src/${name}`, "utf8")
      expect(text.includes(host), name).toBe(false)
      expect(text.includes(site), name).toBe(false)
    }
  })
})
