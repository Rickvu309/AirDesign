import { scriptOf } from "@airdesign/agent/testing/evals"
import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { callTool, type Session } from "@airdesign/agent"
import { memoryDecks } from "@airdesign/agent/testing/evals"
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
  const session: Session = { agent: "aira", mint: () => `m${String((calls += 1))}` }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op]!, args, session, host)
  }
  const { deck, slides } = (await call("execute", { script: "createDeck()" })).fields as {
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
  const { result: id, runId } = landed.fields as { result: string; runId: string }
  const unread = `${id} has a character the deck's fonts lack`
  expect(String(landed.fields.note)).toContain(unread)
  const read = await call("execute", { deck, script: "get().note" })
  expect(String(read.fields.result)).toContain(unread)
  const again = await call("execute", {
    deck,
    runId,
    script: scriptOf([{ op: "set", target: id, name: "Launch line" }]),
  })
  expect(String(again.fields.note)).toContain(unread)
  expect(String(again.fields.note)).not.toContain("Layout clear")
})
