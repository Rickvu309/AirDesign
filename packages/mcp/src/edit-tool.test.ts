import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { memoryDecks } from "./memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom

function agent() {
  const decks = memoryDecks(start)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
  return { decks, call }
}

describe("edit_deck refusals", () => {
  it("refuses a move into a frame inside one an earlier change deleted, and says so in the answer", async () => {
    const by = agent()
    const { deck, slides } = (await by.call("create_deck", {})).answer as { deck: string; slides: string[] }
    const rev = () => by.decks.decks.get(deck as never)!.rev
    const frameIn = async (into?: string) => {
      const change = { op: "add", kind: "frame", slide: slides[0], ...(into === undefined ? {} : { into }) }
      const made = await by.call("edit_deck", { deck, base: rev(), changes: [change] })
      return (made.answer as { added: { id: string }[] }).added[0]!.id
    }
    const outer = await frameIn()
    const middle = await frameIn(outer)
    const inner = await frameIn(middle)
    const base = rev()
    const changes = [
      { op: "delete", nodes: [middle] },
      { op: "move", node: outer, into: inner },
    ]
    const refused = await by.call("edit_deck", { deck, base, changes })
    expect(refused.answer).toMatchObject({ ok: false, refusal: "dead", refused: "missing", at: 1, node: outer })
    expect(String(refused.answer.note)).toContain(`Change 2 (move ${outer})`)
    expect(String(refused.answer.note)).toContain("an earlier change in this edit deleted it or a frame it sits in")
    expect(rev()).toBe(base)
  })
})
