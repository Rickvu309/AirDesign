import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { callTool, emptyLog, type Session } from "@airdesign/mcp"
import { memoryDecks } from "@airdesign/mcp/testing/evals"
import { expect, it } from "vitest"
import { FontMetrics } from "../platform/font-metrics.js"
import { FontSource } from "../platform/font-source.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>
const served = "Geist"
const local = new FontSource(undefined)
const metrics = new FontMetrics({
  family: () => local.family(served),
  file: (_name, file) => local.file(served, file),
})

async function added(theme: doom.Theme, change: Record<string, unknown>) {
  const made = doom.doomFromTree({ theme, slides: [{ children: [] }] })
  const slide = made.slides[0]!
  const decks = memoryDecks(() => made.doom)
  const host = {
    ...decks,
    measure: (folds: readonly doom.Doom[], layers?: readonly doom.NodeId[]) =>
      metrics.measure(folds, undefined, layers),
  }
  const session: Session = { agent: "aira", mint: () => "m", log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call-${op}`
    return callTool(names[op]!, args, session, host)
  }
  const { deck } = (await call("create_deck", {})).answer as { deck: string }
  const before = decks.decks.get(deck as never)!
  const { answer } = await call("edit_deck", { deck, base: before.rev, changes: [{ op: "add", slide, ...change }] })
  const saved = decks.decks.get(deck as never)!
  const row = doom.childrenOf(saved, slide).at(-1)
  if (answer.ok !== true || row === undefined) return { answer }
  const read = await metrics.measure([saved])
  if (typeof read === "string") throw new Error(read)
  return { answer, painted: doom.solveLayout(saved, slide, read.measure).get(row.id)! }
}

const near = Array.from({ length: 3 }, () => ({ title: "l".repeat(69), value: "$4.2M", note: "l".repeat(69) }))

it("keeps a KPI row inside the box it was given, measured with the served fonts", async () => {
  const box = { x: 160, y: 280, w: 1500, h: 281 }
  const { answer, painted } = await added(doom.themeLibrary.consulting!.theme, { kind: "kpi", items: near, box })
  expect(answer).toMatchObject({ ok: true })
  expect(painted!.y).toBe(box.y)
  expect(painted!.h).toBeLessThanOrEqual(box.h)
})

const long = "Customer financial results for the year, after every adjustment the auditors asked for"
const rows = {
  kpi: [3, 5].map((count) => Array.from({ length: count }, () => ({ title: long, value: "$4.2M", note: long }))),
  cards: [2, 4].map((count) => Array.from({ length: count }, () => ({ title: long, icon: "star", points: [long] }))),
  compare: [2, 3].map((count) => Array.from({ length: count }, () => ({ title: long, points: [long, long] }))),
}

it.each(Object.keys(doom.themeLibrary))(
  "never paints a card row with long words past its box in the %s theme",
  async (name) => {
    for (const [kind, sets] of Object.entries(rows))
      for (const items of sets)
        for (const high of [280, 420]) {
          const box = { x: 160, y: 280, w: 1600, h: high }
          const { answer, painted } = await added(doom.themeLibrary[name]!.theme, { kind, items, box })
          const label = `${kind} ${String(items.length)} in ${String(high)}`
          if (answer.ok !== true) expect(answer, label).toMatchObject({ refusal: "limit" })
          else expect(painted!.h, label).toBeLessThanOrEqual(high)
        }
  },
  60_000,
)
