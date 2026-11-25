import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"

import { emptyLog, callTool, type Session, type ToolResult } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function agent() {
  const decks = memoryDecks(() => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] }).doom)
  let minted = 0
  let calls = 0
  const session: Session = {
    agent: "aira",
    name: "Aira",
    mint: () => `minted${String((minted += 1))}`,
    log: emptyLog(),
    now: 0,
  }
  return async (op: string, args: unknown): Promise<ToolResult> => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
}

const tile = (accent: string) => ({
  version: 1,
  name: "KPI tile",
  collections: { kpis: { label: "string", value: "string" } },
  defaults: { accent: { var: accent } },
  parts: [
    {
      repeat: { over: ["get", "data.kpis"], as: "k" },
      emit: {
        kind: "rect",
        key: ["list", "rule", ["get", "k.id"]],
        x: 0,
        y: 0,
        w: ["get", "frame.w"],
        h: 8,
        fill: ["get", "token.accent"],
      },
    },
    {
      repeat: { over: ["get", "data.kpis"], as: "k" },
      emit: {
        kind: "text",
        key: ["list", "value", ["get", "k.id"]],
        x: 0,
        y: 24,
        w: ["get", "frame.w"],
        h: 110,
        chars: ["get", "k.value"],
        style: "bigNumber",
        color: { var: "text" },
        align: "left",
        alignV: "top",
      },
    },
  ],
  sample: { w: 400, h: 140, data: { kpis: [{ id: "a", label: "Revenue", value: "$4.2M" }] } },
})

it("authors a template, places it twice, updates both, and undo_run brings the old spec back at a new revision", async () => {
  const call = agent()
  const made = (await call("create_deck", { name: "Board" })).answer
  const deck = made.deck as string
  const slide = (made.slides as string[])[0]!

  const grammar = (await call("read_deck", { deck, grammar: 1 })).answer
  expect(grammar).toMatchObject({ ok: true, grammar: 1 })
  expect(String(grammar.text)).toContain("# Component spec, grammar 1")

  const added = await call("edit_deck", { deck, base: made.rev, changes: [{ op: "component", spec: tile("accent1") }] })
  expect(added.ok, JSON.stringify(added.answer)).toBe(true)
  const [template] = added.answer.templates as { id: string; revision: number }[]
  expect(template).toMatchObject({ revision: 1, instances: 0 })
  expect(added.answer.added).toEqual([])
  const id = template!.id
  const runId = added.answer.runId as string

  const box = (x: number) => ({ x, y: 300, w: 400, h: 140 })
  const placed = await call("edit_deck", {
    deck,
    base: added.answer.rev,
    runId,
    changes: [box(200), box(800)].map((at) => ({ op: "add", kind: "component", slide, component: id, box: at })),
  })
  expect(placed.ok, JSON.stringify(placed.answer)).toBe(true)

  const read = (await call("read_deck", { deck })).answer
  expect((read.components as string[])[0]).toBe(`${id} "KPI tile" r1, 2 instances, kpis: label, value`)
  expect(String(read.note)).toContain("grammar 1")

  const updated = await call("edit_deck", {
    deck,
    base: placed.answer.rev,
    changes: [{ op: "component", target: id, spec: tile("accent2") }],
  })
  expect(updated.ok, JSON.stringify(updated.answer)).toBe(true)
  expect(updated.answer.templates).toEqual([{ id, revision: 2, instances: 2 }])
  expect(String(updated.answer.note)).toContain(`Template ${id} is at r2, with 2 instances rebuilt.`)

  const component = (await call("read_deck", { deck, component: id })).answer.component as Record<string, any>
  expect(component).toMatchObject({ id, revision: 2, builtIn: false, spec: tile("accent2") })
  expect(component.instances).toHaveLength(2)

  const undone = await call("undo_run", { deck, runId: updated.answer.runId })
  expect(undone.ok, JSON.stringify(undone.answer)).toBe(true)
  const after = (await call("read_deck", { deck, component: id })).answer.component as Record<string, any>
  expect(after).toMatchObject({ revision: 3, spec: tile("accent1") })
})

it("names a spec fault at its path, and a finding in the note", async () => {
  const call = agent()
  const made = (await call("create_deck", { name: "Board" })).answer
  const deck = made.deck as string
  const bad = tile("accent1")
  Object.assign(bad.parts[0]!.emit, { colour: "red" })
  const refused = await call("edit_deck", { deck, base: made.rev, changes: [{ op: "component", spec: bad }] })
  expect(refused.answer).toMatchObject({ ok: false, at: 0, field: "spec.parts[0].emit.colour", fault: "unknown" })

  const tall = tile("accent1")
  tall.parts[1]!.emit.h = 20
  const landed = await call("edit_deck", { deck, base: made.rev, changes: [{ op: "component", spec: tall }] })
  expect(landed.ok, JSON.stringify(landed.answer)).toBe(true)
  expect(String(landed.answer.note)).toMatch(/sample value \/ a needs \d+x\d+ px in a 400x20 box/)
})

it("reads a built-in template's spec as a worked example", async () => {
  const call = agent()
  const made = (await call("create_deck", { name: "Board" })).answer
  const column = (await call("read_deck", { deck: made.deck, component: "column" })).answer
  expect(column.component).toMatchObject({ id: "column", builtIn: true, revision: 1, instances: [] })
  expect((column.component as { spec: { version: number } }).spec.version).toBe(1)
})
