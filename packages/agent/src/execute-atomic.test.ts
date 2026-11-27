import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"

import { callTool, type Answer, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>
const person: doom.Author = { kind: "person", id: "quan" }
const box = (x: number) => `{ x: ${String(x)}, y: 300, w: 200, h: 120 }`

function agent() {
  const decks = memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ name: "One", children: [] }] }).doom)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (args: Record<string, unknown>): Promise<Answer & { fields: Record<string, any> }> => {
    session.once = `call${String((calls += 1))}`
    return (await callTool(names.execute!, args, session, decks)) as Answer & { fields: Record<string, any> }
  }
  return { decks, call }
}

async function opened() {
  const by = agent()
  const made = await by.call({ script: "createDeck()" })
  const { deck, slides } = made.fields as { deck: string; slides: string[] }
  const slide = slides[0]!
  const first = await by.call({
    deck,
    script: `[insert({ parent: "${slide}", kind: "shape", box: ${box(100)} }), insert({ parent: "${slide}", kind: "shape", box: ${box(400)} })]`,
  })
  expect(first.ok, JSON.stringify(first.fields)).toBe(true)
  const [a, b] = first.fields.result as [string, string]
  const fold = () => by.decks.decks.get(deck as never)!
  const kids = (parent: string = slide) => doom.childrenOf(fold(), parent as doom.NodeId).map((node) => node.id)
  const touch = (node: string) =>
    by.decks.edit(deck as never, {
      once: `touch ${node}`,
      author: person,
      writes: [{ node: node as never, prop: "name", value: "Mine" }],
    })
  return { ...by, deck, slide, a, b, runId: first.fields.runId as string, fold, kids, touch }
}

const caught = (operation: string) => `try { ${operation} } catch (thrown) { console.log(String(thrown)) }`

describe("a refused operation the script catches leaves nothing behind", () => {
  it("replaces nothing when the old layer is closed to the run", async () => {
    const by = await opened()
    await by.touch(by.a)
    const answer = await by.call({
      deck: by.deck,
      runId: by.runId,
      script: `${caught(`replace({ target: "${by.a}", kind: "shape", fill: "accent2" })`)}\nupdate({ target: "${by.b}", name: "Kept" })`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(by.kids()).toEqual([by.a, by.b])
    expect(doom.propOf(by.fold().nodes.get(by.b as doom.NodeId)!, "name")).toBe("Kept")
  })

  it("makes no group when its style is refused", async () => {
    const by = await opened()
    const answer = await by.call({
      deck: by.deck,
      script: `${caught(`group({ targets: ["${by.a}", "${by.b}"], textStyle: "title" })`)}\nupdate({ target: "${by.b}", name: "Kept" })`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(by.kids()).toEqual([by.a, by.b])
  })

  it("adds no slide when its look is refused", async () => {
    const by = await opened()
    const answer = await by.call({
      deck: by.deck,
      script: `${caught(`insert({ kind: "slide", fill: "background2", textStyle: "title" })`)}\nupdate({ target: "${by.b}", name: "Kept" })`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(doom.slidesOf(by.fold()).map((each) => each.id)).toEqual([by.slide])
  })

  it("removes no layer when a slide in the same remove is closed to the run", async () => {
    const by = await opened()
    const added = await by.call({ deck: by.deck, runId: by.runId, script: `insert({ kind: "slide" })` })
    const second = added.fields.result as string
    await by.touch(second)
    const answer = await by.call({
      deck: by.deck,
      runId: by.runId,
      script: `${caught(`remove({ targets: ["${by.a}", "${second}"] })`)}\nupdate({ target: "${by.b}", name: "Kept" })`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(by.kids()).toEqual([by.a, by.b])
    expect(doom.slidesOf(by.fold()).map((each) => each.id)).toEqual([by.slide, second])
  })

  it("removes a layer and the last slide together when the script adds a slide after", async () => {
    const by = await opened()
    const answer = await by.call({
      deck: by.deck,
      script: `remove({ targets: ["${by.a}", "${by.slide}"] })\ninsert({ kind: "slide" })`,
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(doom.slidesOf(by.fold()).map((each) => each.id)).not.toContain(by.slide)
    expect(doom.slidesOf(by.fold())).toHaveLength(1)
  })
})

describe("each operation takes one change of the call's hundred", () => {
  const filled = (slide: string) =>
    `for (let i = 0; i < 97; i++) insert({ parent: "${slide}", kind: "shape", box: ${box(10)} })`

  it("fits a replace, a styled group and a styled slide in the last three changes", async () => {
    const by = await opened()
    const answer = await by.call({
      deck: by.deck,
      script: [
        filled(by.slide),
        `replace({ target: "${by.a}", kind: "text", text: "In its place" })`,
        `insert({ kind: "slide", fill: "background2" })`,
        `group({ targets: ["${by.b}"], fill: "accent1", radius: 12 })`,
      ].join("\n"),
    })
    expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
    expect(doom.slidesOf(by.fold())).toHaveLength(2)
  })

  it("refuses the operation past the hundredth change", async () => {
    const by = await opened()
    const answer = await by.call({
      deck: by.deck,
      script: [
        filled(by.slide),
        `update({ target: "${by.a}", name: "a" })`,
        `update({ target: "${by.b}", name: "b" })`,
        `insert({ kind: "slide" })`,
        `insert({ kind: "slide" })`,
      ].join("\n"),
    })
    expect(answer.fields).toMatchObject({ ok: false, refusal: "limit", op: 101 })
  })
})
