import { intentsSchema, catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session } from "./index.js"
import { readOf, scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function agent() {
  const host = {
    ...memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ children: [] }] }).doom),
  }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, host)
  }
}

describe("a shape's outline through the agent tools", () => {
  it("adds a star, reads it back as shape=star5, and refuses a connector as a shape", async () => {
    const call = agent()
    const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
      deck: string
      rev: number
      slides: string[]
    }
    const box = { x: 200, y: 200, w: 300, h: 300 }
    const landed = await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box, shape: "star5" }]),
    })
    expect(landed.ok).toBe(true)
    expect(String((await readOf(call, deck)).fields.layers)).toContain(" shape=star5")
    const refused = await call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "shape", slide: slides[0], box, shape: "bentConnector3" }]),
    })
    expect(refused.ok).toBe(false)
    expect(refused.fields).toMatchObject({ field: "shape" })
    expect(JSON.stringify(intentsSchema)).toContain("Lines and connectors are not shapes: add kind line.")
  })
})
