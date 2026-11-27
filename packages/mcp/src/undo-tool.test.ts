import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"

import { emptyLog, callTool, type Session, type Answer } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks, type MemoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function start(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          {
            type: "shape",
            name: "Title",
            props: {
              role: "title",
              box: { x: 160, y: 380, w: 1600, h: 160, rotation: 0, flipH: false, flipV: false },
              text: doom.textFromMarkdown("Untitled", "title"),
            },
          },
        ],
      },
    ],
  }).doom
}

function agent(decks: MemoryDecks = memoryDecks(start), id = "aira", name = "Aira") {
  let minted = 0
  const session: Session = { agent: id, name, mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  let calls = 0
  return {
    decks,
    call: async (op: string, args: unknown, once?: string): Promise<Answer> => {
      session.once = once ?? `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

async function renamed() {
  const by = agent()
  const made = await by.call("execute", { script: 'createDeck({ name: "Board" })' })
  const deck = made.fields.deck as string
  const fold = by.decks.decks.get(deck as never)!
  const title = [...fold.nodes.values()].find((node) => node.type === "shape")!
  const landed = await by.call("execute", {
    deck,
    script: scriptOf([{ op: "set", target: title.id, name: "Renamed" }]),
  })
  const runId = landed.fields.runId as string
  return { by, deck, rev: landed.fields.rev as number, runId, title: title.id }
}

describe("undo_run", () => {
  it("takes the agent's own run back and says so, then says when there is nothing left", async () => {
    const { by, deck, runId, title } = await renamed()
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.fields).toMatchObject({
      ok: true,
      deck,
      runId,
      kept: [],
      left: [],
      waiting: [],
      note: "Undone",
    })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
    expect(by.decks.decks.get(deck as never)!.runs.get(runId)?.undone).toBe(true)
    const again = await by.call("undo_run", { deck, runId })
    expect(again.fields).toMatchObject({
      ok: false,
      reason: "nothing",
      note: "Unable to undo. Everything it changed was changed or deleted since.",
    })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
  })

  it("leaves a layer a person changed since, says why, and takes the rest back", async () => {
    const by = agent()
    const made = await by.call("execute", { script: 'createDeck({ name: "Board" })' })
    const deck = made.fields.deck as string
    const slides = made.fields.slides as string[]
    const first = await by.call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "text", slide: slides[0], text: "Hello" }]),
    })
    const runId = first.fields.runId as string
    const hello = (first.fields.made as { ids: string[] }[])[0]!.ids[0]!
    const second = await by.call("execute", {
      deck,
      script: scriptOf([{ op: "add", kind: "text", slide: slides[0], text: "Note" }]),
      runId,
    })
    const note = (second.fields.made as { ids: string[] }[])[0]!.ids[0]!
    const person = await by.decks.edit(deck as never, {
      once: "person",
      author: { kind: "person", id: "quan" },
      writes: [{ node: hello as never, prop: "name", value: "Mine" }],
    })
    expect(person.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.fields).toMatchObject({
      ok: true,
      kept: [hello],
      left: [],
      waiting: [],
      note: "Undone. “Mine” stays because it was changed after Aira made it.",
    })
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.propOf(fold.nodes.get(hello as never), "name")).toBe("Mine")
    expect((fold.nodes.get(note as never) as { parent: unknown }).parent).toBeNull()
    expect(fold.runs.get(runId)?.undone).toBe(true)
  })

  it("takes the agent's own turn off a layer it leaves where the agent put it, and keeps the turn the person saw", async () => {
    const by = agent()
    const made = await by.call("execute", { script: 'createDeck({ name: "Board" })' })
    const deck = made.fields.deck as string
    const slide = (made.fields.slides as string[])[0] as doom.NodeId
    const [outer, group, card] = [doom.nodeId("g:101"), doom.nodeId("g:102"), doom.nodeId("g:103")]
    const at = (parent: doom.NodeId) => ({ id: parent, at: doom.orderKeyBetween(null, null) })
    const turned = (x: number, rotation: number) => ({ x, y: x, w: 100, h: 50, rotation, flipH: false, flipV: false })
    const person = { kind: "person" as const, id: "quan" }
    const agentRun = { kind: "agent" as const, id: "aira", run: "run-1", name: "Aira" }
    const edits = [
      {
        once: "setup",
        author: person,
        writes: [
          { node: outer, prop: "type", value: "frame" },
          { node: outer, prop: "parent", value: at(slide) },
          { node: outer, prop: "box", value: turned(100, 20) },
          { node: group, prop: "type", value: "frame" },
          { node: group, prop: "parent", value: at(outer) },
          { node: group, prop: "box", value: turned(50, 10) },
          { node: card, prop: "type", value: "shape" },
          { node: card, prop: "parent", value: at(group) },
          { node: card, prop: "box", value: turned(40, 0) },
        ],
      },
      {
        once: "agent-start",
        author: agentRun,
        phase: "start",
        writes: [
          { node: card, prop: "parent", value: at(slide) },
          { node: card, prop: "box", value: turned(190, 0) },
        ],
      },
      { once: "agent-stop", author: agentRun, phase: "stop", writes: [] },
      { once: "delete-outer", author: person, writes: [{ node: outer, prop: "parent", value: null }] },
    ]
    for (const edit of edits) expect((await by.decks.edit(deck as never, edit as never)).ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId: "run-1" })
    expect(undone.fields).toMatchObject({ ok: true, kept: [], left: [card], waiting: [] })
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.parentOf(fold.nodes.get(card)!)?.id).toBe(slide)
    expect(doom.propOf(fold.nodes.get(card), "box")).toEqual(turned(190, 30))
  })

  it("refuses another agent's run, and still undoes a run that has stopped", async () => {
    const { by, deck, runId, title } = await renamed()
    const other = agent(by.decks, "other", "Other")
    const refused = await other.call("undo_run", { deck, runId })
    expect(refused.fields).toMatchObject({ ok: false, refusal: "run-fenced" })
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.fields.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.fields).toMatchObject({ ok: true, note: "Undone" })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
  })
})

describe("design details an agent sets", () => {
  it("writes typography, appearance, tile fit and icon weight, then undoes the run", async () => {
    const asset = "a".repeat(64)
    const by = agent(
      memoryDecks(
        () =>
          doom.doomFromTree({
            theme: doom.defaultTheme,
            slides: [
              {
                children: [
                  { type: "shape", name: "Words", props: { text: doom.textFromMarkdown("Hello", "body") } },
                  {
                    type: "shape",
                    name: "Card",
                    props: { geometry: { kind: "rect" }, fills: [{ kind: "solid", color: { var: "accent1" } }] },
                  },
                  { type: "shape", name: "Photo", props: { fills: [{ kind: "image", asset, fit: "fit" }] } },
                  { type: "shape", name: "Star", props: { geometry: { kind: "icon", name: "lucide/star" } } },
                ],
              },
            ],
          }).doom,
      ),
    )
    const made = await by.call("execute", { script: 'createDeck({ name: "Design details" })' })
    const deck = made.fields.deck
    const key = [...by.decks.decks.keys()].find((id) => id === deck)
    if (key === undefined) throw new Error("No deck was created")
    const before = by.decks.decks.get(key)!
    const layer = (name: string) => {
      const node = [...before.nodes.values()].find((node) => doom.propOf(node, "name") === name)
      if (node === undefined) throw new Error(`Missing layer ${name}`)
      return node.id
    }
    const words = layer("Words")
    const card = layer("Card")
    const photo = layer("Photo")
    const star = layer("Star")
    const edited = await by.call("execute", {
      deck,
      script: scriptOf([
        { op: "set", target: words, lineHeight: 1.5, letterSpacing: 2.5, case: "upper" },
        { op: "set", target: card, opacity: 0.6, radius: 18, stroke: "accent2", strokeWidth: 6, effect: "glow" },
        { op: "set", target: photo, fit: "tile" },
        { op: "set", target: star, strokeWidth: 8 },
      ]),
    })
    expect(edited.fields).toMatchObject({ ok: true })
    const written = by.decks.decks.get(key)!
    expect(doom.propOf(written.nodes.get(words), "text")).toMatchObject({
      paras: [{ lineHeight: 1.5 }],
      spans: [{ tracking: 2.5, case: "upper" }],
    })
    expect(doom.propOf(written.nodes.get(card), "opacity")).toBe(0.6)
    expect(doom.propOf(written.nodes.get(card), "radius")).toBe(18)
    expect(doom.propOf(written.nodes.get(card), "stroke")?.weight).toBe(6)
    expect(doom.propOf(written.nodes.get(card), "effects")).toBe("glow")
    expect(doom.propOf(written.nodes.get(photo), "fills")).toEqual([{ kind: "image", asset, fit: "tile" }])
    expect(doom.propOf(written.nodes.get(star), "stroke")?.weight).toBe(8)

    const strength = await by.call("execute", {
      deck,
      runId: edited.fields.runId,
      script: scriptOf([{ op: "set", target: card, effectOpacity: 0.4 }]),
    })
    expect(strength.fields).toMatchObject({ ok: true })
    expect(doom.propOf(by.decks.decks.get(key)?.nodes.get(card), "effects")).toEqual(
      doom.defaultTheme.effectStyles.glow.map((effect) => ({ ...effect, opacity: 0.4 })),
    )

    const undone = await by.call("undo_run", { deck, runId: edited.fields.runId })
    expect(undone.fields).toMatchObject({ ok: true, kept: [], left: [], waiting: [] })
    const restored = by.decks.decks.get(key)!
    for (const [id, fields] of [
      [words, ["text"]],
      [card, ["opacity", "radius", "strokes", "stroke", "effects"]],
      [photo, ["fills"]],
      [star, ["stroke"]],
    ] as const) {
      for (const field of fields) {
        expect(doom.propOf(restored.nodes.get(id), field)).toEqual(doom.propOf(before.nodes.get(id), field))
      }
    }
  })
})

it("undoes consecutive runs that both renamed the same layer", async () => {
  const { by, deck, runId, title } = await renamed()
  const newer = await by.call("execute", {
    deck,
    script: scriptOf([{ op: "set", target: title, name: "Newer" }]),
  })
  expect(newer.fields.ok).toBe(true)
  expect((await by.call("undo_run", { deck, runId: newer.fields.runId })).fields.ok).toBe(true)
  expect(doom.propOf(by.decks.decks.get(deck as never)?.nodes.get(title), "name")).toBe("Renamed")
  expect((await by.call("undo_run", { deck, runId })).fields.ok).toBe(true)
  expect(doom.propOf(by.decks.decks.get(deck as never)?.nodes.get(title), "name")).toBe("Title")
})

it("explains a run undo that exceeds the size limit", async () => {
  const { by, deck, runId } = await renamed()
  const withUndo = by.decks.withUndo
  vi.spyOn(by.decks, "withUndo").mockImplementation((deck, turn) =>
    withUndo(deck, (locked) => turn({ ...locked, run: async () => ({ ok: false, refusal: "size" }) })),
  )
  expect((await by.call("undo_run", { deck, runId })).fields).toMatchObject({
    ok: false,
    refusal: "size",
    note: "Unable to undo. This run made too many changes.",
  })
})
