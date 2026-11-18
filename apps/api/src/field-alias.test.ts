import { deckRoutes } from "@airdesign/catalog"
import { writeTextValue } from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { account, address, connected, deckOf, grant, startAgents, stores, type Agent } from "./agents-drive.js"
import { ask } from "./harness.js"

let stop = async () => {}
beforeAll(async () => {
  stop = await startAgents()
})
afterAll(async () => stop())

const element = (node: string) => ({
  node,
  kind: "shape",
  value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
  grouped: false,
})
const elements = ["256.2", "256.3"].map(element)

type Landed = { readonly visible: boolean; readonly patch?: Record<string, Record<string, unknown>> }

async function landed(deck: string, node: string): Promise<readonly Landed[]> {
  const found = await stores.deck.query<{ register: { elements: Record<string, { landed: Landed[] }> } }>(
    "select register from deck.saved where id = $1",
    [deck],
  )
  return found.rows[0]?.register.elements[node]?.landed ?? []
}

async function edit(agent: Agent, deck: string, text: Record<string, unknown>, target: string) {
  const read = await agent.call("read_deck", { deck })
  return agent.call("edit_deck", { deck, base: read.body.revision, changes: [{ op: "set", target, text }] })
}

it("lands text.lineSpacing, with its old percent, as text.lineHeight for a connected agent and for Aira, and refuses both spellings at once", async () => {
  const owner = await account()
  const deck = await deckOf(owner)
  const page = {
    deck,
    once: "index",
    offset: 0,
    total: 2,
    slides: [{ id: "256", position: 0, layout: elements }],
    elements,
  }
  expect((await ask(address.base, "POST", deckRoutes.index.path, page, owner.cookie)).json).toMatchObject({ ok: true })
  const callers = [
    { agent: await connected({ authorization: `Bearer ${await grant(owner, "claude")}` }), node: "256.2" },
    { agent: await connected({ cookie: owner.cookie }), node: "256.3" },
  ]
  for (const { agent, node } of callers) {
    const both = await edit(agent, deck, { lineHeight: 150, lineSpacing: 120 }, node)
    expect(both.body).toMatchObject({ ok: false, refusal: "field" })
    expect(both.said).toContain("text.lineHeight")
    const aliased = await edit(agent, deck, { lineSpacing: 150 }, node)
    expect(aliased.body, aliased.text).toMatchObject({ ok: true })
    const rows = await landed(deck, node)
    const written = rows.at(-1)?.patch?.text?.value as { readonly set: string } | undefined
    expect(JSON.parse(written?.set ?? "[]")).toEqual([expect.objectContaining({ lineHeight: 150_000 })])
    const canonical = await edit(agent, deck, { lineHeight: 150 }, node)
    expect(canonical.body, canonical.text).toMatchObject({ ok: true })
    expect((await landed(deck, node)).at(-1)?.patch).toEqual(rows.at(-1)?.patch)
  }
})

it("lands line, the border's old name, as border for a connected agent and for Aira, and refuses both names at once", async () => {
  const owner = await account()
  const deck = await deckOf(owner)
  const page = { deck, once: "index", offset: 0, total: 2, slides: [{ id: "256", position: 0 }], elements }
  expect((await ask(address.base, "POST", deckRoutes.index.path, page, owner.cookie)).json).toMatchObject({ ok: true })
  const callers = [
    { agent: await connected({ authorization: `Bearer ${await grant(owner, "claude")}` }), node: "256.2" },
    { agent: await connected({ cookie: owner.cookie }), node: "256.3" },
  ]
  for (const { agent, node } of callers) {
    const set = async (change: Record<string, unknown>) => {
      const read = await agent.call("read_deck", { deck })
      return agent.call("edit_deck", {
        deck,
        base: read.body.revision,
        changes: [{ op: "set", target: node, ...change }],
      })
    }
    const both = await set({ line: { width: 2 }, border: { width: 3 } })
    expect(both.body).toMatchObject({ ok: false, refusal: "field" })
    expect(both.said).toContain("border.width")
    const aliased = await set({ line: { width: 2, dash: "dash" } })
    expect(aliased.body, aliased.text).toMatchObject({ ok: true })
    const rows = await landed(deck, node)
    expect(rows.at(-1)?.patch).toEqual({ border: { width: { set: 25_400 }, dash: { set: "dash" } } })
    const canonical = await set({ border: { width: 2, dash: "dash" } })
    expect(canonical.body, canonical.text).toMatchObject({ ok: true })
    expect((await landed(deck, node)).at(-1)?.patch).toEqual(rows.at(-1)?.patch)
  }
})
