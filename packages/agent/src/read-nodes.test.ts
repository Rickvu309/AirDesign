import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Answer = Record<string, any>

function agent() {
  const decks = memoryDecks(start)
  const measured: (readonly doom.NodeId[] | undefined)[] = []
  const host: DeckHost = {
    ...decks,
    measure: async (_folds, layers) => {
      measured.push(layers)
      return { measure: estimate, missing: new Map() }
    },
  }
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((calls += 1))}` }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ...result, fields: result.fields as Answer }
  }
  const made = async () =>
    (await call("execute", { script: "createDeck()" })).fields as { deck: string; slides: string[] }
  return { decks, call, made, measured }
}

const cards = `
  const s = insert({ kind: "slide" })
  const row = insert({ parent: s, kind: "frame", name: "Cards", layout: "row", gap: 24, box: { x: 120, y: 200, w: 1500, h: 600 } })
  const sizes = [1, 3, 2]
  const made = sizes.map((lines, i) => {
    const card = insert({ parent: row, kind: "frame", name: "Card " + i, layout: "column", gap: 8, padding: 16, fill: "accent1", box: { x: 0, y: 0, w: 400, h: 80 + lines * 60 } })
    for (let line = 0; line < lines; line++) insert({ parent: card, kind: "text", text: "Line " + line })
    return card
  })
`

describe("get gives a script structured layers", () => {
  it("places a callout beneath the tallest card from one slide read, with no text parsing", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `${cards}
        const slide = get({ target: s })
        const laid = slide.nodes.filter((n) => n.parent === row)
        const tallest = laid.reduce((a, b) => (b.box.h > a.box.h ? b : a))
        const bottom = Math.max(...laid.map((n) => n.box.y + n.box.h))
        const callout = insert({ parent: s, kind: "text", text: "Tallest", box: { x: tallest.box.x, y: bottom + 24, w: 300, h: 40 } })
        ;({ callout, tallest: tallest.id, card: made[1], heights: laid.map((n) => n.box.h), bottom })
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const { callout, tallest, card, heights, bottom } = answer.fields.result
    expect(tallest).toBe(card)
    expect(heights[1]).toBeGreaterThan(heights[0])
    expect(heights[1]).toBeGreaterThan(heights[2])
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.propOf(fold.nodes.get(callout)!, "box")?.y).toBe(bottom + 24)
  })

  it("reads a layer as its own structured node and its descendants in tree order", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `${cards}
        const read = get({ target: made[0] })
        ;({ read, ids: [made[0], ...get({ target: made[0] }).children] })
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const { read, ids } = answer.fields.result
    expect(read.nodes.map((node: Answer) => node.id)).toEqual(ids)
    const [card, line] = read.nodes
    expect(card).toMatchObject({
      id: read.id,
      kind: "frame",
      parent: read.parent,
      fill: "accent1",
      children: read.children,
    })
    expect(card.box).toEqual({ ...read.box, rotation: 0 })
    expect(line).toMatchObject({ kind: "text", parent: read.id, text: "Line 0", textStyle: "body", children: [] })
    expect(Object.keys(line.box).sort()).toEqual(["h", "rotation", "w", "x", "y"])
    expect(JSON.parse(JSON.stringify(read.nodes))).toEqual(read.nodes)
  })

  it("lists every live layer of a slide, and not the slide itself", async () => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", {
      deck,
      script: `${cards}
        const read = get({ target: s })
        ;({ ids: read.nodes.map((n) => n.id), first: read.nodes[0], layers: read.layers })
      `,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    const { ids, first, layers } = answer.fields.result
    const lines = (layers as string).split("\n").slice(1)
    expect(ids).toEqual(lines.map((line) => line.trim().split(" ")[0]))
    expect(first.kind).not.toBe("slide")
  })
})

describe("get lays a view out once", () => {
  const timesLaid = async (reads: string) => {
    const by = agent()
    const { deck } = await by.made()
    const answer = await by.call("execute", { deck, script: `${cards}\n${reads}` })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    return by.measured.length
  }

  it("reuses the layout across reads of one view, and lays out again after an edit", async () => {
    const once = await timesLaid(`get({ target: s })`)
    const thrice = await timesLaid(`get({ target: s }); get({ target: made[0] }); get({ target: made[1] })`)
    expect(thrice).toBe(once)
    const edited = await timesLaid(
      `get({ target: s }); update({ target: made[0], fill: "accent2" }); get({ target: made[0] }); get({ target: made[1] })`,
    )
    const editedOnce = await timesLaid(`update({ target: made[0], fill: "accent2" }); get({ target: made[0] })`)
    expect(edited).toBe(editedOnce + 1)
  })
})
