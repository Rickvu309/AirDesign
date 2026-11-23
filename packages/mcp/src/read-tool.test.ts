import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { memoryDecks } from "./memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const titled = () =>
  doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom

function agent() {
  const decks = memoryDecks(titled)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  return (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
}

describe("read_deck find, and one change over every slide's title", () => {
  it("restyles every slide's title in one change and finds each by the words of its line", async () => {
    const call = agent()
    const made = (await call("create_deck", {})).answer as { deck: string; rev: number; slides: string[] }
    const { deck, rev, slides } = made
    const added = await call("edit_deck", { deck, base: rev, changes: [{ op: "duplicate", nodes: [slides[0]] }] })
    expect(added.ok).toBe(true)
    const runId = (added.answer as { runId: string }).runId
    const styled = await call("edit_deck", {
      deck,
      base: rev + 1,
      runId,
      changes: [{ op: "set", target: "*.title", textStyle: "heading" }],
    })
    expect(styled.ok).toBe(true)
    const found = await call("read_deck", { deck, find: "style=heading" })
    expect(found.answer).toMatchObject({ ok: true, found: 2, rev: rev + 2 })
    const lines = String(found.answer.layers).split("\n")
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(line).toMatch(/^\S+ \S+ text:title .*style=heading/)
    expect(String(found.answer.note)).toContain("2 layers in deck")
    expect((await call("read_deck", { deck, find: "nothing like this" })).answer).toMatchObject({
      found: 0,
      layers: "",
    })
  })
})

describe("read_deck's theme", () => {
  it("names each text style's size, so an agent picks a size on the deck's own scale", async () => {
    const call = agent()
    const { deck } = (await call("create_deck", {})).answer as { deck: string }
    const read = await call("read_deck", { deck })
    expect(read.answer).toMatchObject({
      theme: {
        sizes: { display: 88, bigNumber: 80, title: 56, heading: 40, body: 32, body2: 28, caption: 24, label: 24 },
      },
    })
  })
})
