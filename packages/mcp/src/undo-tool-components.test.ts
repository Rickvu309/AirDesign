import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"

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

it("undoes an agent's template update as a fresh update, and rebuilds an instance a person deleted since when it returns", async () => {
  const by = agent()
  const made = await by.call("create_deck", { name: "Board" })
  const deck = made.answer.deck as never
  const slide = (made.answer.slides as doom.NodeId[])[0]!
  const at = doom.orderKeyBetween(null, null)
  const component = doom.nodeId("template:1")
  const spec = (w: number) => ({
    version: 1,
    name: "Tile",
    collections: {},
    parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w, h: 100, fill: { var: "accent1" } } }],
    sample: { w: 300, h: 100, data: {} },
  })
  const fold = () => by.decks.decks.get(deck)!
  const top = [...fold().nodes.values()].find(({ type }) => type === "deck")!.id
  const person: doom.Author = { kind: "person", id: "quan" }
  const authored = await by.decks.edit(deck, {
    once: "template",
    author: person,
    writes: [
      { node: component, prop: "type", value: "component" },
      { node: component, prop: "parent", value: { id: top, at } },
      { node: component, prop: "name", value: "Tile" },
      { node: component, prop: "spec", value: spec(100) },
      { node: component, prop: "revision", value: 1 },
    ],
  })
  expect(authored.ok).toBe(true)
  const frames = [doom.nodeId("tile:1"), doom.nodeId("tile:2")]
  for (const [index, frame] of frames.entries()) {
    const box = { x: index * 400, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
    const writes = doom.placeComponent(
      fold(),
      { node: component, revision: 1 },
      { frame, parent: { id: slide, at }, box, data: {}, measure: doom.measureWith({}) },
    )
    if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
    expect(
      (await by.decks.edit(deck, { once: `place${index}`, author: person, readBase: fold().rev, writes })).ok,
    ).toBe(true)
  }
  const before = fold()
  const update = doom.prepareComponentEdit(
    before,
    [
      { node: component, prop: "spec", value: spec(200), base: before.revs.get(component)!.get("spec")! },
      { node: component, prop: "revision", value: 2, base: before.revs.get(component)!.get("revision")! },
    ],
    doom.measureWith({}),
  )
  if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
  const run = { kind: "agent", id: "aira", run: "restyle", name: "Aira" } as const
  expect(
    (await by.decks.edit(deck, { once: "restyle", author: run, phase: "start", readBase: before.rev, writes: update }))
      .ok,
  ).toBe(true)
  const deleted = frames[1]!
  const deleting = {
    once: "delete",
    author: person,
    writes: [{ node: deleted, prop: "parent", value: null }] as doom.Write[],
  }
  const restyled = fold()
  expect((await by.decks.edit(deck, deleting)).ok).toBe(true)
  const undone = await by.call("undo_run", { deck, runId: "restyle" })
  expect(undone.answer).toMatchObject({ ok: true, kept: [], left: [], waiting: [], note: "Undone" })
  expect(doom.propOf(fold().nodes.get(component), "revision")).toBe(3)
  expect(doom.propOf(fold().nodes.get(frames[0]!), "instance")).toEqual({
    ...doom.propOf(before.nodes.get(frames[0]!), "instance"),
    component: { node: component, revision: 3 },
  })
  expect(doom.propOf(fold().nodes.get(deleted), "instance")?.component).toEqual({ node: component, revision: 2 })
  const now = fold()
  const back = doom.invert(
    restyled,
    now,
    { ...deleting, rev: now.onces.get("delete")! },
    new Set(),
    doom.measureWith({}),
  )
  expect((await by.decks.edit(deck, { once: "undelete", author: person, readBase: now.rev, writes: back })).ok).toBe(
    true,
  )
  expect(doom.propOf(fold().nodes.get(deleted), "instance")).toEqual({
    ...doom.propOf(before.nodes.get(deleted), "instance"),
    component: { node: component, revision: 3 },
  })
})

async function nestedTemplate() {
  const by = agent()
  const made = await by.call("create_deck", { name: "Board" })
  const deck = made.answer.deck as never
  const fold = () => by.decks.decks.get(deck)!
  const top = [...fold().nodes.values()].find(({ type }) => type === "deck")!.id
  const row = [...fold().nodes.values()].find(({ type }) => type === "slideRow")!.id
  const at = doom.orderKeyBetween(null, null)
  const component = doom.nodeId("template:1")
  const slide = doom.nodeId("slide:1")
  const group = doom.nodeId("group:1")
  const frame = doom.nodeId("tile:1")
  const box = { x: 0, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const person: doom.Author = { kind: "person", id: "quan" }
  const seeded = await by.decks.edit(deck, {
    once: "seed",
    author: person,
    writes: [
      { node: component, prop: "type", value: "component" },
      { node: component, prop: "parent", value: { id: top, at } },
      { node: component, prop: "name", value: "Tile" },
      { node: component, prop: "spec", value: tile(100) },
      { node: component, prop: "revision", value: 1 },
      { node: slide, prop: "type", value: "slide" },
      { node: slide, prop: "parent", value: { id: row, at: doom.orderKeyBetween(at, null) } },
      { node: group, prop: "type", value: "frame" },
      { node: group, prop: "parent", value: { id: slide, at } },
      { node: group, prop: "box", value: box },
    ],
  })
  expect(seeded.ok).toBe(true)
  const placed = doom.placeComponent(
    fold(),
    { node: component, revision: 1 },
    { frame, parent: { id: group, at }, box, data: {}, measure: doom.measureWith({}) },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  expect((await by.decks.edit(deck, { once: "place", author: person, readBase: fold().rev, writes: placed })).ok).toBe(
    true,
  )
  const part = doom.propOf(fold().nodes.get(frame), "instance")!.parts[0]!.node
  const edit = async (once: string, author: doom.Author, writes: readonly doom.Write[]) => {
    const phase = author.kind === "agent" ? ({ phase: "start" } as const) : {}
    const landed = await by.decks.edit(deck, { once, author, ...phase, readBase: fold().rev, writes })
    expect(landed).toMatchObject({ ok: true })
  }
  const update = async (once: string, author: doom.Author, spec: unknown, revision: number) => {
    const now = fold()
    const writes = doom.prepareComponentEdit(
      now,
      [
        { node: component, prop: "spec", value: spec, base: now.revs.get(component)!.get("spec")! },
        { node: component, prop: "revision", value: revision, base: now.revs.get(component)!.get("revision")! },
      ],
      doom.measureWith({}),
    )
    if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
    await edit(once, author, writes)
  }
  return { by, deck, fold, component, slide, frame, part, person, edit, update }
}

const tile = (w: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

const aira = (run: string): doom.Author => ({ kind: "agent", id: "aira", run, name: "Aira" })

it("brings a slide back by undo_run with its instance detached when the template can no longer build it", async () => {
  const { by, deck, fold, slide, frame, part, person, edit, update } = await nestedTemplate()
  const linked = fold()
  await edit("remove", aira("remove"), [{ node: slide, prop: "parent", value: null }])
  const requiring = {
    ...tile(200),
    collections: { rows: { note: "string" } },
    sample: { w: 300, h: 100, data: { rows: [{ id: "a", note: "sample" }] } },
  }
  await update("require", person, requiring, 2)
  const undone = await by.call("undo_run", { deck, runId: "remove" })
  expect(undone.answer).toMatchObject({ ok: true })
  expect(doom.onDeck(fold().nodes, slide)).toBe(true)
  expect(doom.propOf(fold().nodes.get(frame), "instance")).toBeUndefined()
  expect(fold().nodes.get(part)).toEqual(linked.nodes.get(part))
})

it("rebuilds a slide brought back by undo_run at the current spec after a template update was undone and redone", async () => {
  const { by, deck, fold, component, slide, frame, part, person, edit, update } = await nestedTemplate()
  await update("widen", aira("widen"), tile(200), 2)
  await edit("remove", aira("remove"), [{ node: slide, prop: "parent", value: null }])
  expect((await by.call("undo_run", { deck, runId: "widen" })).answer).toMatchObject({ ok: true })
  expect(doom.propOf(fold().nodes.get(component), "revision")).toBe(3)
  await update("wider", person, tile(300), 4)
  expect((await by.call("undo_run", { deck, runId: "remove" })).answer).toMatchObject({ ok: true })
  expect(doom.onDeck(fold().nodes, slide)).toBe(true)
  expect(doom.propOf(fold().nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 4 })
  expect(doom.propOf(fold().nodes.get(part), "box")?.w).toBe(300)
})

it("undoes an agent's template update by undo_run after a person placed another instance of it", async () => {
  const { by, deck, fold, component, frame, person, edit, update } = await nestedTemplate()
  await update("widen", aira("widen"), tile(200), 2)
  const later = doom.nodeId("tile:2")
  const box = { x: 0, y: 200, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const group = doom.nodeId("group:1")
  const placed = doom.placeComponent(
    fold(),
    { node: component, revision: 2 },
    {
      frame: later,
      parent: { id: group, at: doom.orderKeyBetween(null, null) },
      box,
      data: {},
      measure: doom.measureWith({}),
    },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  await edit("later", person, placed)
  const undone = await by.call("undo_run", { deck, runId: "widen" })
  expect(undone.answer).toMatchObject({ ok: true, kept: [], left: [], waiting: [] })
  expect(doom.propOf(fold().nodes.get(component), "revision")).toBe(3)
  expect(doom.propOf(fold().nodes.get(component), "spec")).toEqual(tile(100))
  for (const root of [frame, later]) {
    const instance = doom.propOf(fold().nodes.get(root), "instance")!
    expect(instance.component).toEqual({ node: component, revision: 3 })
    expect(doom.propOf(fold().nodes.get(instance.parts[0]!.node), "box")?.w).toBe(100)
  }
})
