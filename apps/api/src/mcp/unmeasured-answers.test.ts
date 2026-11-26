import { scriptOf } from "@airdesign/mcp/testing/evals"
import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { callTool, emptyLog, type Session } from "@airdesign/mcp"
import { memoryDecks } from "@airdesign/mcp/testing/evals"
import { expect, it } from "vitest"
import { FontMetrics } from "../platform/font-metrics.js"
import { FontSource } from "../platform/font-source.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>
const family = "Liberation Sans Narrow"

const start = () =>
  doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts: { heading: family, body: family } },
    slides: [{ children: [] }],
  }).doom

it("keeps naming a text its font cannot measure on every read and edit after the first", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const host = { ...memoryDecks(start), measure: (folds: readonly doom.Doom[]) => metrics.measure(folds) }
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `m${String((calls += 1))}`, log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op]!, args, session, host)
  }
  const { deck, slides } = (await call("create_deck", {})).answer as {
    deck: string
    rev: number
    slides: string[]
  }
  const landed = await call("execute", {
    deck,
    script: scriptOf([
      { op: "add", kind: "text", slide: slides[0], text: "Launch 🚀", box: { x: 160, y: 300, w: 800, h: 80 } },
    ]),
  })
  const { made, runId } = landed.answer as { made: { ids: string[] }[]; runId: string }
  const id = made[0]!.ids[0]!
  const unread = `${id} has a character the deck's fonts lack`
  expect(String(landed.answer.note)).toContain(unread)
  const read = await call("execute", { deck, script: "get().note" })
  expect(String(read.answer.result)).toContain(unread)
  const again = await call("execute", {
    deck,
    runId,
    script: scriptOf([{ op: "set", target: id, name: "Launch line" }]),
  })
  expect(String(again.answer.note)).toContain(unread)
  expect(String(again.answer.note)).not.toContain("Layout clear")
})
