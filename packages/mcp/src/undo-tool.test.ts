import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"

import { emptyLog, callTool, type Session, type ToolResult } from "./index.js"
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
    call: async (op: string, args: unknown, once?: string): Promise<ToolResult> => {
      session.once = once ?? `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

async function renamed() {
  const by = agent()
  const made = await by.call("create_deck", { name: "Board" })
  const deck = made.answer.deck as string
  const rev = made.answer.rev as number
  const fold = by.decks.decks.get(deck as never)!
  const title = [...fold.nodes.values()].find((node) => node.type === "shape")!
  const landed = await by.call("edit_deck", {
    deck,
    base: rev,
    changes: [{ op: "set", target: title.id, name: "Renamed" }],
  })
  const runId = landed.answer.runId as string
  return { by, deck, rev: landed.answer.rev as number, runId, title: title.id }
}

describe("undo_run", () => {
  it("takes the agent's own run back and says so, then says when there is nothing left", async () => {
    const { by, deck, runId, title } = await renamed()
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({
      ok: true,
      deck,
      runId,
      kept: [],
      left: [],
      waiting: [],
      note: "Undone",
    })
    expect(undone.content).toEqual([{ type: "text", text: JSON.stringify(undone.answer) }])
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
    expect(by.decks.decks.get(deck as never)!.runs.get(runId)?.undone).toBe(true)
    const again = await by.call("undo_run", { deck, runId })
    expect(again.answer).toMatchObject({
      ok: false,
      reason: "nothing",
      note: "Unable to undo. Everything it changed was changed or deleted since.",
    })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
  })

  it("leaves a layer a person changed since, says why, and takes the rest back", async () => {
    const by = agent()
    const made = await by.call("create_deck", { name: "Board" })
    const deck = made.answer.deck as string
    const slides = made.answer.slides as string[]
    const first = await by.call("edit_deck", {
      deck,
      base: made.answer.rev,
      changes: [{ op: "add", kind: "text", slide: slides[0], text: "Hello" }],
    })
    const runId = first.answer.runId as string
    const hello = (first.answer.added as { id: string }[])[0]!.id
    const second = await by.call("edit_deck", {
      deck,
      base: first.answer.rev,
      changes: [{ op: "add", kind: "text", slide: slides[0], text: "Note" }],
      runId,
    })
    const note = (second.answer.added as { id: string }[])[0]!.id
    const person = await by.decks.edit(deck as never, {
      once: "person",
      author: { kind: "person", id: "quan" },
      writes: [{ node: hello as never, prop: "name", value: "Mine" }],
    })
    expect(person.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({
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
    const made = await by.call("create_deck", { name: "Board" })
    const deck = made.answer.deck as string
    const slide = (made.answer.slides as string[])[0] as doom.NodeId
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
    expect(undone.answer).toMatchObject({ ok: true, kept: [], left: [card], waiting: [] })
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.parentOf(fold.nodes.get(card)!)?.id).toBe(slide)
    expect(doom.propOf(fold.nodes.get(card), "box")).toEqual(turned(190, 30))
  })

  it("refuses another agent's run, and still undoes a run that has stopped", async () => {
    const { by, deck, runId, title } = await renamed()
    const other = agent(by.decks, "other", "Other")
    const refused = await other.call("undo_run", { deck, runId })
    expect(refused.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.answer.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({ ok: true, note: "Undone" })
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
    const made = await by.call("create_deck", { name: "Design details" })
    const deck = made.answer.deck
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
    const edited = await by.call("edit_deck", {
      deck,
      base: made.answer.rev,
      changes: [
        { op: "set", target: words, lineHeight: 1.5, letterSpacing: 2.5, case: "upper" },
        { op: "set", target: card, opacity: 0.6, radius: 18, stroke: "accent2", strokeWidth: 6, effect: "glow" },
        { op: "set", target: photo, fit: "tile" },
        { op: "set", target: star, strokeWidth: 8 },
      ],
    })
    expect(edited.answer).toMatchObject({ ok: true })
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

    const strength = await by.call("edit_deck", {
      deck,
      base: edited.answer.rev,
      runId: edited.answer.runId,
      changes: [{ op: "set", target: card, effectOpacity: 0.4 }],
    })
    expect(strength.answer).toMatchObject({ ok: true })
    expect(doom.propOf(by.decks.decks.get(key)?.nodes.get(card), "effects")).toEqual(
      doom.defaultTheme.effectStyles.glow.map((effect) => ({ ...effect, opacity: 0.4 })),
    )

    const undone = await by.call("undo_run", { deck, runId: edited.answer.runId })
    expect(undone.answer).toMatchObject({ ok: true, kept: [], left: [], waiting: [] })
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

it.each(["data update", "person delete", "later run", "in-flight rename"])(
  "undo_run restores its own bar after %s",
  async (between) => {
    const person: doom.Author = { kind: "person", id: "person" }
    const frame = doom.nodeId("chart:1")
    const measure = doom.measureWith({})
    const data = (value: number) => ({
      rows: [
        { id: "a", label: "A", value },
        { id: "b", label: "B", value: 2 },
      ],
    })
    const by = agent(
      memoryDecks(() => {
        const { doom: before, slides } = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] })
        const writes = doom.placeComponent(before, {
          frame,
          parent: { id: slides[0]!, at: doom.orderKeyBetween(null, null) },
          box: { x: 100, y: 100, w: 1500, h: 700, rotation: 0, flipH: false, flipV: false },
          data: data(1),
          measure,
        })
        if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
        const placed = doom.applyEdit(before, {
          once: "place",
          author: person,
          rev: doom.rev(before.rev + 1),
          readBase: before.rev,
          writes,
        })
        if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
        return placed
      }),
    )
    const created = await by.call("create_deck", { name: "Board" })
    const named = readDeckId(created.answer.deck)
    if (!named.ok) throw new Error(JSON.stringify(created.answer))
    const { deck } = named
    const fold = () => by.decks.decks.get(deck)!
    const inst = () => doom.propOf(fold().nodes.get(frame), "instance")!
    const bar = (id: string) => inst().parts.find(({ key }) => key[0] === "bar" && key[1] === id)!.node
    const a = bar("a")
    const b = bar("b")
    const remove = (node: doom.NodeId) =>
      by.call("edit_deck", { deck, base: fold().rev, changes: [{ op: "delete", nodes: [node] }] })
    const deleted = await remove(a)
    expect(deleted.answer.ok).toBe(true)
    if (between === "data update") {
      const update = doom.regenerateComponent(fold(), frame, { data: data(9) }, measure)
      if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
      expect(
        await by.decks.edit(deck, { once: "update", author: person, writes: update.writes, readBase: fold().rev }),
      ).toMatchObject({ ok: true })
    } else if (between === "person delete") {
      expect(
        await by.decks.edit(deck, {
          once: "delete",
          author: person,
          writes: [{ node: b, prop: "parent", value: null }],
        }),
      ).toMatchObject({ ok: true })
    } else if (between === "in-flight rename") {
      const withUndo = by.decks.withUndo
      vi.spyOn(by.decks, "withUndo").mockImplementation(async (deck, turn) => {
        const slide = doom.parentOf(fold().nodes.get(frame))!.id
        expect(
          await by.decks.edit(deck, {
            once: "race",
            author: person,
            writes: [{ node: slide, prop: "name", value: "Raced" }],
          }),
        ).toMatchObject({ ok: true })
        return withUndo(deck, turn)
      })
    } else {
      expect((await remove(b)).answer.ok).toBe(true)
    }
    const undone = await by.call("undo_run", { deck, runId: deleted.answer.runId })
    expect(undone.answer).toMatchObject({ ok: true, left: [], kept: [], waiting: [], note: "Undone" })
    expect(bar("a")).toBe(a)
    expect(doom.onDeck(fold().nodes, b)).toBe(between === "data update" || between === "in-flight rename")
    expect(inst().data.rows).toEqual(data(between === "data update" ? 9 : 1).rows)
  },
)

it("undoes consecutive runs that both renamed the same layer", async () => {
  const { by, deck, runId, rev, title } = await renamed()
  const newer = await by.call("edit_deck", {
    deck,
    base: rev,
    changes: [{ op: "set", target: title, name: "Newer" }],
  })
  expect(newer.answer.ok).toBe(true)
  expect((await by.call("undo_run", { deck, runId: newer.answer.runId })).answer.ok).toBe(true)
  expect(doom.propOf(by.decks.decks.get(deck as never)?.nodes.get(title), "name")).toBe("Renamed")
  expect((await by.call("undo_run", { deck, runId })).answer.ok).toBe(true)
  expect(doom.propOf(by.decks.decks.get(deck as never)?.nodes.get(title), "name")).toBe("Title")
})

it("explains a run undo that exceeds the size limit", async () => {
  const { by, deck, runId } = await renamed()
  const withUndo = by.decks.withUndo
  vi.spyOn(by.decks, "withUndo").mockImplementation((deck, turn) =>
    withUndo(deck, (locked) => turn({ ...locked, run: async () => ({ ok: false, refusal: "size" }) })),
  )
  expect((await by.call("undo_run", { deck, runId })).answer).toMatchObject({
    ok: false,
    refusal: "size",
    note: "Unable to undo. This run made too many changes.",
  })
})
