import { randomBytes } from "node:crypto"

import { doomRoutes, mcpRoutes, readDeckId } from "@airdesign/catalog"
import {
  detachComponent,
  deckOf,
  isRefusal,
  measureWith,
  nodeId,
  onDeck,
  orderKeyBetween,
  placeComponent,
  columnDefinition,
  propOf,
  readFold,
  regenerateComponent,
  type Edit,
} from "@airdesign/doom"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { expect, it, vi } from "vitest"

import { openDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"

it.each([
  "a linked update and detach after 6,000 edits",
  "a linked update and detach after 50,000 edits",
  "concurrent edits",
  "100 deletions",
  "a linked update and detach",
  "a linked update and detach after consecutive suppressions",
  "a linked update and detach after another run updated the chart",
  "a later person update",
  "a data update followed by a measured label style",
  "a body font change",
  "placing a chart",
  "placing a chart that another device recolours",
  "placing and updating a chart",
  "placing a chart and deleting a bar",
  "updating one chart, then placing and updating another",
])(
  "undoes linked agent runs with %s",
  async (scenario) => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-undo-session")
    const deck = openPool(info.deck, "mcp-undo-deck")
    const listen = new DeckListen(info.listen)
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    const mails: Mail[] = []
    const email = `undo${randomBytes(4).toString("hex")}@example.com`
    const server = await serve({
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      session,
      deck,
      listen,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    try {
      const cookie = await signInByCode(server.base, mails, email)
      await client.connect(
        new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, server.base), {
          requestInit: { headers: { cookie } },
        }),
      )
      const call = async (name: string, args: Record<string, unknown>) => {
        const { content, structuredContent: answer } = await client.callTool({
          name: `airdesign_${name}`,
          arguments: args,
        })
        if (typeof answer !== "object" || answer === null || !("ok" in answer) || answer.ok !== true)
          throw new Error(JSON.stringify(content))
        const fields: Record<string, unknown> = { ...answer }
        return fields
      }
      const created = await call("create_deck", { name: "Board" })
      const parsed = readDeckId(created.deck)
      if (!parsed.ok) throw new Error("no deck in tool answer")
      const id = parsed.deck
      const fold = async () => {
        const stored = await openDoom(deck, { deck: id }, email)
        const read = stored.ok ? readFold(stored.fold) : undefined
        if (read === undefined) throw new Error("could not open stored fold")
        return read
      }
      const slide = startIds.slide
      const frame = nodeId("chart:1")
      const measure = measureWith({})
      const data = (value: number) => ({
        rows:
          scenario !== "100 deletions"
            ? [{ id: "a", label: "Alpha", value }]
            : Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, label: `R${i}`, value: value + i })),
      })
      const send = async (edit: Edit) => {
        const result = await ask(server.base, "POST", doomRoutes.edit.path, { deck: id, edit }, cookie)
        expect(result.json).toMatchObject({ ok: true })
      }
      const person: Edit["author"] = { kind: "person", id: "other-device" }
      const opened = await fold()
      const seedFont: Edit["writes"] =
        scenario === "a body font change" || scenario.includes("measured label style")
          ? [
              { node: startIds.deck, prop: "theme.fonts.heading", value: "Liberation Sans Narrow" },
              { node: startIds.deck, prop: "theme.fonts.body", value: "Liberation Sans Narrow" },
            ]
          : []
      const writes = placeComponent(opened, columnDefinition, {
        frame,
        parent: { id: slide, at: orderKeyBetween(null, null) },
        box: { x: 240, y: 180, w: 1440, h: 720, rotation: 0, flipH: false, flipV: false },
        data: data(1),
        measure,
      })
      if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
      await send({ once: "place", author: person, writes: [...seedFont, ...writes], readBase: opened.rev })
      if (scenario === "a body font change") {
        const current = await fold()
        const changed = await call("edit_deck", {
          deck: id,
          base: current.rev,
          changes: [{ op: "deck", fonts: { body: "Geist" } }],
        })
        const next = await fold()
        expect(next.rev).toBe(current.rev + 1)
        expect(deckOf(next).theme.fonts.body).toBe("Geist")
        expect(next.revs.get(frame)?.get("instance")).toBe(next.rev)
        expect(await call("undo_run", { deck: id, runId: changed.runId })).toMatchObject({ ok: true, note: "Undone" })
        expect(deckOf(await fold()).theme).toEqual(deckOf(current).theme)
        return
      }
      const update = async (value: number) => {
        const run = await call("edit_deck", {
          deck: id,
          base: (await fold()).rev,
          changes: [{ op: "set", target: frame, name: `Chart ${value}` }],
        })
        const current = await fold()
        const runId = run.runId
        if (typeof runId !== "string") throw new Error("Missing run ID")
        const agent = current.runs.get(runId)?.agent
        if (agent === undefined) throw new Error("Missing run")
        const made = regenerateComponent(current, frame, { data: data(value) }, measure)
        if (isRefusal(made)) throw new Error(JSON.stringify(made))
        await send({
          once: `data-${value}`,
          author: { kind: "agent", id: agent, run: runId },
          writes: made.writes,
          readBase: current.rev,
        })
        return runId
      }
      if (scenario.includes("measured label style")) {
        const before = await fold()
        const instance = propOf(before.nodes.get(frame), "instance")!
        const label = instance.parts.find(({ key }) => key[0] === "category")!.node
        const runId = await update(2)
        await call("edit_deck", {
          deck: id,
          base: (await fold()).rev,
          runId,
          changes: [{ op: "set", target: label, textStyle: "body" }],
        })
        const result = await ask(server.base, "POST", doomRoutes.run.path, { deck: id, run: runId }, cookie)
        const log = doomRoutes.run.result(result.json)
        expect(log).toMatchObject({
          ok: true,
          replaced: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ node: frame, key: "instance", value: instance })]),
          ]),
        })
        expect(await call("undo_run", { deck: id, runId })).toMatchObject({ ok: true, kept: [], note: "Undone" })
        const restored = await fold()
        expect(propOf(restored.nodes.get(frame), "instance")).toEqual(instance)
        expect(propOf(restored.nodes.get(label), "text")).toEqual(propOf(before.nodes.get(label), "text"))
        return
      }
      if (scenario === "a later person update") {
        const runId = await update(2)
        const current = await fold()
        const next = regenerateComponent(current, frame, { data: data(3) }, measure)
        if (isRefusal(next)) throw new Error(JSON.stringify(next))
        await send({ once: "person-update", author: person, readBase: current.rev, writes: next.writes })
        expect(await call("undo_run", { deck: id, runId })).toMatchObject({
          ok: true,
          note: "Undone. Later changes to “Chart 2” were kept.",
          kept: [frame],
        })
        expect(propOf((await fold()).nodes.get(frame), "instance")?.data).toEqual(data(3))
        return
      }
      if (scenario.includes("placing")) {
        const mixed = scenario.startsWith("updating one")
        const runId = mixed
          ? await update(2)
          : (
              await call("edit_deck", {
                deck: id,
                base: (await fold()).rev,
                changes: [{ op: "set", target: slide, name: "Place chart" }],
              })
            ).runId
        if (typeof runId !== "string") throw new Error("Missing run ID")
        let current = await fold()
        const agent = current.runs.get(runId)!.agent
        const author: Edit["author"] = { kind: "agent", id: agent, run: runId }
        const placedFrame = nodeId("chart:2")
        const writes = placeComponent(current, columnDefinition, {
          frame: placedFrame,
          parent: { id: slide, at: orderKeyBetween(null, null) },
          box: { x: 240, y: 180, w: 1440, h: 720, rotation: 0, flipH: false, flipV: false },
          data: data(3),
          measure,
        })
        if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
        await send({ once: "place-in-run", author, writes, readBase: current.rev })
        current = await fold()
        if (scenario.includes("updating")) {
          const changed = regenerateComponent(
            current,
            placedFrame,
            {
              data: { rows: [{ id: "b", label: "Beta", value: 9 }] },
            },
            measure,
          )
          if (isRefusal(changed)) throw new Error(JSON.stringify(changed))
          const also = mixed ? regenerateComponent(current, frame, { data: data(4) }, measure) : undefined
          if (isRefusal(also)) throw new Error(JSON.stringify(also))
          await send({
            once: "update-in-run",
            author,
            writes: [...changed.writes, ...(also?.writes ?? [])],
            readBase: current.rev,
          })
        } else if (scenario.includes("deleting")) {
          const bar = propOf(current.nodes.get(placedFrame), "instance")!.parts.find(
            ({ key }) => key[0] === "bar",
          )!.node
          await send({ once: "delete-in-run", author, writes: [{ node: bar, prop: "parent", value: null }] })
        }
        const placed = await fold()
        const instance = propOf(placed.nodes.get(placedFrame), "instance")!
        if (scenario.includes("recolours")) {
          const bar = instance.parts.find(({ key }) => key[0] === "bar")!.node
          const fills = [{ kind: "solid", color: { var: "accent2" } }]
          await send({ once: "other-colour", author: person, writes: [{ node: bar, prop: "fills", value: fills }] })
          expect(await call("undo_run", { deck: id, runId })).toMatchObject({
            note: "Undone. “Chart” stays because it was changed after Aira made it.",
            kept: [placedFrame],
            left: [],
          })
          const after = await fold()
          expect(onDeck(after.nodes, placedFrame)).toBe(true)
          expect(propOf(after.nodes.get(bar), "fills")).toEqual(fills)
          expect(propOf(after.nodes.get(slide), "name")).toBe(propOf(opened.nodes.get(slide), "name"))
          return
        }
        expect(await call("undo_run", { deck: id, runId })).toMatchObject({ ok: true, note: "Undone" })
        const undone = await fold()
        for (const node of [placedFrame, instance.generated, ...instance.parts.map(({ node }) => node)])
          expect(onDeck(undone.nodes, node)).toBe(false)
        expect(propOf(undone.nodes.get(frame), "instance")?.data).toEqual(data(1))
        return
      }
      if (scenario === "100 deletions") {
        const runId = await update(2)
        const updated = await fold()
        const agent = updated.runs.get(runId)!.agent
        const bars = propOf(updated.nodes.get(frame), "instance")!.parts.filter(({ key }) => key[0] === "bar")
        expect(bars).toHaveLength(100)
        for (let from = 0; from < bars.length; from += 10) {
          await send({
            once: `delete-bars-${from}`,
            author: { kind: "agent", id: agent, run: runId },
            writes: bars.slice(from, from + 10).map(({ node }) => ({ node, prop: "parent", value: null })),
          })
        }
        expect(propOf((await fold()).nodes.get(frame), "instance")?.suppressed).toHaveLength(100)
        const storage = await deck.query<{ bytes: number; checkpoint: number; largestDeletion: number }>(
          `
        select sum(octet_length(replaced::text))::int as bytes,
          max(octet_length(replaced ->> 'before')) filter (where once = 'data-2') as checkpoint,
          max(octet_length(replaced ->> 'before')) filter (where once like 'delete-bars-%') as "largestDeletion"
        from deck.doom_edit where deck = $1 and edit -> 'author' ->> 'run' = $2
      `,
          [id, runId],
        )
        expect(storage.rows[0]!.bytes).toBeLessThan(100_000)
        expect(storage.rows[0]!.largestDeletion).toBeLessThan(storage.rows[0]!.checkpoint / 2)
        const log = await ask(server.base, "POST", doomRoutes.run.path, { deck: id, run: runId }, cookie)
        expect(log.json).toMatchObject({ ok: true })
        expect(Buffer.byteLength(JSON.stringify(log.json))).toBeLessThan(100_000)
        expect(await call("undo_run", { deck: id, runId })).toMatchObject({ ok: true, note: "Undone" })
        expect(propOf((await fold()).nodes.get(frame), "instance")).toMatchObject({ data: data(1), suppressed: [] })
        return
      }
      if (scenario.startsWith("a linked update and detach")) {
        const afterAnotherRun = scenario.endsWith("another run updated the chart")
        if (scenario.endsWith("edits")) {
          const prior = scenario.includes("50,000") ? 50_000 : 6_000
          await deck.query(
            `
            with renames as (
              select $3::int + i as rev, 'history-' || i as once, 'Slide ' || i as name
              from generate_series(1, $4::int) i
            ), logged as (
              insert into deck.doom_edit (deck, rev, once, edit)
              select $1, rev, once, jsonb_build_object(
                'once', once, 'author', '{"kind":"person","id":"history"}'::jsonb,
                'writes', jsonb_build_array(jsonb_build_object('node', $2::text, 'prop', 'name', 'value', name))
              ) from renames
            ), named as (
              update deck.doom_node set
                node = jsonb_set(node, '{name}', to_jsonb('Slide ' || $4::text)),
                revs = jsonb_set(revs, '{name}', to_jsonb($3::int + $4::int))
              where deck = $1 and id = $2
            )
            update deck.doom set rev = $3::int + $4::int where id = $1
          `,
            [id, slide, (await fold()).rev, prior],
          )
        }
        const undoOpen = await openDoom(deck, { deck: id, forUndo: true }, email)
        const undoFold = undoOpen.ok ? readFold(undoOpen.fold) : undefined
        expect(undoFold?.onces.size).toBe(0)
        expect(undoFold?.rev).toBe((await fold()).rev)
        if (afterAnotherRun) await update(2)
        const runId = await update(afterAnotherRun ? 3 : 2)
        let updated = await fold()
        const agent = updated.runs.get(runId)!.agent
        if (scenario.endsWith("suppressions")) {
          const parts = propOf(updated.nodes.get(frame), "instance")!.parts
          for (const { node, key } of parts.filter(({ key }) => key[0] === "bar" || key[0] === "category")) {
            await send({
              once: "suppress-" + key[0],
              author: { kind: "agent", id: agent, run: runId },
              writes: [{ node, prop: "parent", value: null }],
            })
          }
          updated = await fold()
          expect(propOf(updated.nodes.get(frame), "instance")?.suppressed).toHaveLength(2)
        }
        const writes = detachComponent(updated, frame)
        if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
        const queries = vi.spyOn(deck, "query")
        await send({ once: "detach", author: { kind: "agent", id: agent, run: runId }, writes, readBase: updated.rev })
        const statements = queries.mock.calls.map(([query]) => query)
        queries.mockRestore()
        expect(
          statements.filter(
            (query) => typeof query === "string" && /from deck\.doom_edit\s+where deck = \$1 and rev >/.test(query),
          ),
        ).toEqual([])
        expect(statements.length).toBeLessThanOrEqual(5)
        expect(propOf((await fold()).nodes.get(frame), "instance")).toBeUndefined()
        if (scenario.endsWith("suppressions")) {
          const result = await ask(server.base, "POST", doomRoutes.run.path, { deck: id, run: runId }, cookie)
          const log = doomRoutes.run.result(result.json)
          expect(log).toMatchObject({
            edits: expect.arrayContaining([
              expect.objectContaining({
                once: "suppress-bar",
                writes: [{ node: expect.any(String), prop: "parent", value: null }],
              }),
            ]),
            replaced: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  node: frame,
                  key: "instance",
                  value: expect.objectContaining({ suppressed: [{ key: ["category", "a"], reason: "delete" }] }),
                }),
              ]),
            ]),
          })
        }
        expect(await call("undo_run", { deck: id, runId })).toMatchObject({ ok: true, note: "Undone" })
        expect(propOf((await fold()).nodes.get(frame), "instance")).toMatchObject({
          data: data(afterAnotherRun ? 2 : 1),
          suppressed: [],
        })
        return
      }
      const older = await update(2)
      const newer = await update(3)
      const start = (await fold()).rev
      const [undone] = await Promise.all([
        call("undo_run", { deck: id, runId: newer }),
        ...Array.from({ length: 6 }, (_, index) =>
          send({
            once: `rename-${index}`,
            author: person,
            writes: [{ node: slide, prop: "name", value: `Race ${index}` }],
          }),
        ),
      ])
      expect(undone).toMatchObject({ ok: true, note: "Undone" })
      const after = await fold()
      expect(after.rev).toBe(start + 7)
      expect(propOf(after.nodes.get(slide), "name")).toMatch(/^Race [0-5]$/)
      expect(propOf(after.nodes.get(frame), "instance")?.data).toEqual(data(2))
      expect(await call("undo_run", { deck: id, runId: older })).toMatchObject({
        ok: true,
        note: "Undone",
      })
      expect(propOf((await fold()).nodes.get(frame), "instance")?.data).toEqual(data(1))
    } finally {
      await client.close()
      await server.close()
      await Promise.all([session.end(), deck.end(), listen.close()])
    }
  },
  15_000,
)
