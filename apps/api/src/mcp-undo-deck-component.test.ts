import { randomBytes } from "node:crypto"

import { doomRoutes, mcpRoutes, readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"

import { openDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"

const component = doom.nodeId("tpl:1")
const slide = doom.nodeId("tpl:2")
const group = doom.nodeId("tpl:3")
const frame = doom.nodeId("tpl:4")
const later = doom.nodeId("tpl:5")
const at = doom.orderKeyBetween(null, null)
const box = { x: 0, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
const measure = doom.measureWith({})
const person: doom.Edit["author"] = { kind: "person", id: "person" }

const tile = (w: number, rows = false) => ({
  version: 1,
  name: "Tile",
  collections: rows ? { rows: { note: "string" } } : {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: rows ? { rows: [{ id: "a", note: "sample" }] } : {} },
})

type Stack = Awaited<ReturnType<typeof open>>

async function open() {
  const info = await postgresInfo()
  const session = openPool(info.session, "mcp-template-undo-session")
  const decks = openPool(info.deck, "mcp-template-undo-deck")
  const listen = new DeckListen(info.listen)
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  const mails: Mail[] = []
  const email = `template${randomBytes(4).toString("hex")}@example.com`
  const server = await serve({
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    session,
    deck: decks,
    listen,
    send: async (mail) => {
      mails.push(mail)
    },
  })
  const cookie = await signInByCode(server.base, mails, email)
  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, server.base), {
      requestInit: { headers: { cookie } },
    }),
  )
  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, unknown>
  const created = await call("create_deck", { name: "Board" })
  const parsed = readDeckId(created.deck)
  if (!parsed.ok) throw new Error("no deck in tool answer")
  const deck = parsed.deck
  const fold = async () => {
    const stored = await openDoom(decks, { deck }, email)
    const read = stored.ok ? doom.readFold(stored.fold) : undefined
    if (read === undefined) throw new Error("could not open stored fold")
    return read
  }
  const initial = await fold()
  const send = async (edit: doom.Edit) =>
    (await ask(server.base, "POST", doomRoutes.edit.path, { deck, edit }, cookie)).json
  const sent = async (once: string, author: doom.Edit["author"], writes: readonly doom.Write[]) => {
    const now = await fold()
    const answer = await send({ once, author, readBase: now.rev, writes })
    expect(answer, JSON.stringify(answer)).toMatchObject({ ok: true })
    return { before: now, edit: { once, author, writes, rev: (await fold()).rev } satisfies doom.Landed }
  }
  const replayed = async () => {
    const log = doomRoutes.since.result(
      (await ask(server.base, "POST", doomRoutes.since.path, { deck, rev: initial.rev }, cookie)).json,
    )
    if (!log.ok) throw new Error(JSON.stringify(log))
    let replay = initial
    for (const landed of log.edits) {
      const read = doom.readLanded(landed, replay)
      if (doom.isRefusal(read)) throw new Error(JSON.stringify(read))
      const next = doom.applyEdit(replay, read)
      if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
      replay = next
    }
    return replay
  }
  const close = async () => {
    await client.close()
    await server.close()
    await Promise.all([session.end(), decks.end(), listen.close()])
  }
  return { call, deck, fold, send, sent, replayed, close }
}

async function seeded(stack: Stack, roots: readonly doom.NodeId[]) {
  await stack.sent("seed", person, [
    { node: component, prop: "type", value: "component" },
    { node: component, prop: "parent", value: { id: startIds.deck, at } },
    { node: component, prop: "name", value: "Tile" },
    { node: component, prop: "spec", value: tile(100) },
    { node: component, prop: "revision", value: 1 },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: { id: startIds.row, at: doom.orderKeyBetween(at, null) } },
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: { id: slide, at } },
    { node: group, prop: "box", value: box },
  ])
  for (const root of roots) await stack.sent(`place-${root}`, person, placing(await stack.fold(), root, 1))
  const run = await stack.call("edit_deck", {
    deck: stack.deck,
    base: (await stack.fold()).rev,
    changes: [{ op: "set", target: startIds.slide, name: "First slide" }],
  })
  const runId = String(run.runId)
  const agent: doom.Edit["author"] = { kind: "agent", id: (await stack.fold()).runs.get(runId)!.agent, run: runId }
  return { runId, agent }
}

function placing(fold: doom.Doom, root: doom.NodeId, revision: number, data: object = {}) {
  const writes = doom.placeComponent(
    fold,
    { node: component, revision },
    { frame: root, parent: { id: group, at: doom.orderKeyBetween(null, null) }, box, data, measure },
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return writes
}

function updating(fold: doom.Doom, spec: unknown, revision: number) {
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const writes = doom.prepareComponentEdit(
    fold,
    [
      { node: component, prop: "spec", value: spec, base: base("spec") },
      { node: component, prop: "revision", value: revision, base: base("revision") },
    ],
    measure,
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return writes
}

const linkOf = (fold: doom.Doom, root: doom.NodeId) => doom.propOf(fold.nodes.get(root), "instance")
const widthOf = (fold: doom.Doom, root: doom.NodeId, part?: doom.NodeId) =>
  doom.propOf(fold.nodes.get(part ?? linkOf(fold, root)!.parts[0]!.node), "box")?.w

it.each([
  "a later instance",
  "a later instance the old spec cannot build",
  "an instance deleted since",
  "a slide restored after a template update",
  "a slide restored after a template delete",
  "a slide restored after a schema change",
  "an instance restored after a template update",
  "a slide restored after an undone and replaced update",
])(
  "undoes template work through MCP undo_run against Postgres with %s",
  async (scenario) => {
    const stack = await open()
    try {
      const deletedSince = scenario === "an instance deleted since"
      const { runId, agent } = await seeded(stack, deletedSince ? [frame, later] : [frame])
      const part = linkOf(await stack.fold(), frame)!.parts[0]!.node
      if (scenario.startsWith("a later instance") || scenario === "an instance deleted since") {
        const rows = scenario.endsWith("cannot build")
        if (rows) await stack.sent("hide", person, [{ node: frame, prop: "parent", value: null }])
        await stack.sent("widen", agent, updating(await stack.fold(), tile(200, rows), 2))
        if (deletedSince) {
          const deleting = await stack.sent("delete", person, [{ node: later, prop: "parent", value: null }])
          expect(await stack.call("undo_run", { deck: stack.deck, runId })).toMatchObject({ ok: true, kept: [] })
          const reverted = await stack.fold()
          expect(linkOf(reverted, frame)?.component).toEqual({ node: component, revision: 3 })
          const back = doom.invert(deleting.before, reverted, deleting.edit, new Set(), measure)
          await stack.sent("undelete", person, back)
          const restored = await stack.fold()
          expect(linkOf(restored, later)?.component).toEqual({ node: component, revision: 3 })
          expect(widthOf(restored, later)).toBe(100)
          expect((await stack.replayed()).nodes).toEqual(restored.nodes)
          return
        }
        const data = rows ? { rows: [{ id: "a", note: "later" }] } : {}
        await stack.sent("other", person, placing(await stack.fold(), later, 2, data))
        const placed = (await stack.fold()).nodes.get(linkOf(await stack.fold(), later)!.parts[0]!.node)
        expect(await stack.call("undo_run", { deck: stack.deck, runId })).toMatchObject({
          ok: true,
          kept: [],
          left: [],
          waiting: [],
        })
        const reverted = await stack.fold()
        expect(doom.propOf(reverted.nodes.get(component), "spec")).toEqual(tile(100))
        expect(doom.propOf(reverted.nodes.get(component), "revision")).toBe(3)
        if (rows) {
          expect(linkOf(reverted, later)).toBeUndefined()
          expect(reverted.nodes.get(placed!.id)).toEqual(placed)
        } else
          for (const root of [frame, later]) {
            expect(linkOf(reverted, root)?.component).toEqual({ node: component, revision: 3 })
            expect(widthOf(reverted, root)).toBe(100)
          }
        expect((await stack.replayed()).nodes).toEqual(reverted.nodes)
        return
      }
      if (scenario === "a slide restored after an undone and replaced update") {
        const widened = await stack.sent("widen", person, updating(await stack.fold(), tile(200), 2))
        await stack.sent("remove", agent, [{ node: slide, prop: "parent", value: null }])
        const gone = await stack.fold()
        await stack.sent("roll-back", person, doom.invert(widened.before, gone, widened.edit, new Set(), measure))
        const rolled = await stack.fold()
        expect(doom.propOf(rolled.nodes.get(component), "revision")).toBe(3)
        expect(
          await stack.send({
            once: "reuse",
            author: person,
            readBase: rolled.rev,
            writes: [
              { node: component, prop: "spec", value: tile(300), base: rolled.revs.get(component)!.get("spec")! },
              { node: component, prop: "revision", value: 2, base: rolled.revs.get(component)!.get("revision")! },
            ],
          }),
        ).toMatchObject({ ok: false, refused: "shape", prop: "revision" })
        await stack.sent("wider", person, updating(rolled, tile(300), 4))
        expect(await stack.call("undo_run", { deck: stack.deck, runId })).toMatchObject({ ok: true })
        const restored = await stack.fold()
        expect(linkOf(restored, frame)?.component).toEqual({ node: component, revision: 4 })
        expect(widthOf(restored, frame, part)).toBe(300)
        expect((await stack.replayed()).nodes).toEqual(restored.nodes)
        return
      }
      const removed = scenario.startsWith("an instance") ? frame : slide
      await stack.sent("remove", agent, [{ node: removed, prop: "parent", value: null }])
      const gone = await stack.fold()
      const changes: readonly doom.Write[] = scenario.endsWith("template delete")
        ? [{ node: component, prop: "parent", value: null }]
        : updating(gone, tile(200, scenario.endsWith("schema change")), 2)
      await stack.sent("change", person, changes)
      expect(await stack.call("undo_run", { deck: stack.deck, runId })).toMatchObject({ ok: true })
      const restored = await stack.fold()
      expect(doom.onDeck(restored.nodes, frame)).toBe(true)
      const rebuilt = scenario.endsWith("template update")
      expect(linkOf(restored, frame)?.component).toEqual(rebuilt ? { node: component, revision: 2 } : undefined)
      expect(widthOf(restored, frame, part)).toBe(rebuilt ? 200 : 100)
      expect((await stack.replayed()).nodes).toEqual(restored.nodes)
    } finally {
      await stack.close()
    }
  },
  60_000,
)

it("names a template deleted since when MCP undo_run undoes the rest of the run, and leaves it as restored", async () => {
  const stack = await open()
  try {
    const { runId, agent } = await seeded(stack, [frame])
    await stack.sent("widen", agent, updating(await stack.fold(), tile(200), 2))
    const deleting = await stack.sent("delete", person, [{ node: component, prop: "parent", value: null }])
    const undone = await stack.call("undo_run", { deck: stack.deck, runId })
    expect(undone).toMatchObject({ ok: true, kept: [], left: [], waiting: [], skipped: [component] })
    expect(undone.note).toMatch(/The component “Tile” was deleted, so its update wasn't undone\.$/)
    const partial = await stack.fold()
    expect(partial.runs.get(runId)?.undone).toBe(true)
    expect(doom.propOf(partial.nodes.get(startIds.slide), "name")).not.toBe("First slide")
    expect((await stack.replayed()).nodes).toEqual(partial.nodes)

    const inverse = doom.invertStep(deleting.before, partial, deleting.edit, new Set(), measure)
    if (doom.isRefusal(inverse)) throw new Error(JSON.stringify(inverse))
    await stack.sent("restore", person, inverse)
    expect(await stack.call("undo_run", { deck: stack.deck, runId })).toMatchObject({ ok: false, reason: "nothing" })
    const stored = await stack.fold()
    expect(linkOf(stored, frame)?.component).toEqual({ node: component, revision: 2 })
    expect(widthOf(stored, frame)).toBe(200)
    expect((await stack.replayed()).nodes).toEqual(stored.nodes)
  } finally {
    await stack.close()
  }
}, 60_000)

it("refuses a template update that changes only its revision through the edit route", async () => {
  const stack = await open()
  try {
    const { agent } = await seeded(stack, [frame])
    const before = await stack.fold()
    const base = (prop: "spec" | "revision") => before.revs.get(component)!.get(prop)!
    const bump = { node: component, prop: "revision", value: 2, base: base("revision") } satisfies doom.Write
    const same = { node: component, prop: "spec", value: tile(100), base: base("spec") } satisfies doom.Write
    expect(doom.prepareComponentEdit(before, [same, bump], measure)).toMatchObject({ refused: "shape", prop: "spec" })
    for (const writes of [[bump], [same, bump]])
      expect(
        await stack.send({ once: crypto.randomUUID(), author: agent, readBase: before.rev, writes }),
      ).toMatchObject({
        ok: false,
        refused: "shape",
        node: component,
        prop: "revision",
      })
    expect((await stack.fold()).nodes).toEqual(before.nodes)
  } finally {
    await stack.close()
  }
}, 60_000)
