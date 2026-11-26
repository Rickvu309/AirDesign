import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { readOf, scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"

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

describe("get with find, and one change over every slide's title", () => {
  it("restyles every slide's title in one change and finds each by the words of its line", async () => {
    const call = agent()
    const made = (await call("create_deck", {})).answer as { deck: string; rev: number; slides: string[] }
    const { deck, rev, slides } = made
    const added = await call("execute", { deck, script: scriptOf([{ op: "duplicate", nodes: [slides[0]] }]) })
    expect(added.ok).toBe(true)
    const runId = (added.answer as { runId: string }).runId
    const styled = await call("execute", {
      deck,
      runId,
      script: scriptOf([{ op: "set", target: "*.title", textStyle: "heading" }]),
    })
    expect(styled.ok).toBe(true)
    const found = await readOf(call, deck, { find: "style=heading" })
    expect(found.answer).toMatchObject({ found: 2, rev: rev + 2 })
    const lines = String(found.answer.layers).split("\n")
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(line).toMatch(/^\S+ \S+ text:title .*style=heading/)
    expect((await readOf(call, deck, { find: "nothing like this" })).answer).toMatchObject({
      found: 0,
      layers: "",
    })
  })
})

describe("the deck's theme in get", () => {
  it("names each text style's size, so an agent picks a size on the deck's own scale", async () => {
    const call = agent()
    const { deck } = (await call("create_deck", {})).answer as { deck: string }
    const read = await readOf(call, deck)
    expect(read.answer).toMatchObject({
      theme: {
        sizes: { display: 88, bigNumber: 80, title: 56, heading: 40, body: 32, body2: 28, caption: 24, label: 24 },
      },
    })
  })
})

it("reads a deck without listing templates and refuses template lookup", async () => {
  const call = agent()
  const { deck } = (await call("create_deck", {})).answer as { deck: string }
  const read = await readOf(call, deck)
  expect(read.ok).toBe(true)
  expect(read.answer).not.toHaveProperty("components")
  for (const request of [{ grammar: 1 }, { component: "column" }]) {
    const script = `get(${JSON.stringify(request)})`
    expect((await call("execute", { deck, script })).answer).toMatchObject({ ok: false, refusal: "field" })
  }
})

it("refuses to author or place a template without changing the deck", async () => {
  const call = agent()
  const { deck, rev, slides } = (await call("create_deck", {})).answer as {
    deck: string
    rev: number
    slides: string[]
  }
  const target = JSON.stringify(slides[0])
  for (const verb of ["component", "detach"]) {
    const result = await call("execute", { deck, script: `${verb}({ target: ${target} })` })
    expect(result.answer).toMatchObject({ ok: false, refusal: "script", line: 1 })
  }
  const placed = await call("execute", {
    deck,
    script: scriptOf([{ op: "add", kind: "component", slide: slides[0] }]),
  })
  expect(placed.answer).toMatchObject({ ok: false, refusal: "field", op: 1, field: "kind" })
  for (const field of ["component", "spec", "data", "variant", "tokens", "focus"]) {
    const result = await call("execute", { deck, script: `update({ target: ${target}, ${field}: {} })` })
    expect(result.answer).toMatchObject({ ok: false, refusal: "field", op: 1, field })
  }
  expect((await readOf(call, deck)).answer).toMatchObject({ rev })
})
