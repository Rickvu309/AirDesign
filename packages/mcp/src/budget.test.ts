import { listStyles, readSkillIndex } from "@airdesign/skills"
import { expect, it } from "vitest"

import { emptyLog } from "./admit.js"
import type { Answer } from "./answer.js"
import * as budget from "./budget.js"
import { callTool, type Session } from "./call-tool.js"
import { encode } from "./encode.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { evalDeckId } from "./testing/score.js"
import { suite } from "./testing/suite.js"

const sizeOf = (answer: Answer) => Buffer.byteLength(JSON.stringify(encode(answer)))

async function largestAnswers(): Promise<Readonly<Record<string, number>>> {
  const largest: Record<string, number> = {}
  let calls = 0
  const session: Session = { agent: "eval", mint: () => `call${String((calls += 1))}`, log: emptyLog(), now: 0 }
  const call = async (decks: ReturnType<typeof memoryDecks>, name: string, raw: unknown) => {
    const answer = await callTool(name, raw, session, decks)
    largest[name] = Math.max(largest[name] ?? 0, sizeOf(answer))
    return answer
  }
  for (const row of suite) {
    for (const attempt of [row.reference, row.wrong.attempt]) {
      const start = row.task.deck()
      const decks = memoryDecks(() => start, new Map([[evalDeckId, start]]))
      const runs = new Set<string>()
      for (const step of attempt) {
        const answer = await call(decks, step.name, step.raw)
        if (typeof answer.fields.runId === "string") runs.add(answer.fields.runId)
      }
      await call(decks, "airdesign_get_app_state", {})
      await call(decks, "airdesign_execute", { deck: evalDeckId, script: "get()" })
      await call(decks, "airdesign_execute", { deck: evalDeckId, script: "get().layers" })
      for (const runId of runs) await call(decks, "airdesign_undo_run", { deck: evalDeckId, runId })
    }
  }
  const decks = memoryDecks(() => suite[0]!.task.deck())
  await call(decks, "airdesign_read_skill", {})
  for (const { name } of readSkillIndex().skills) await call(decks, "airdesign_read_skill", { name })
  await call(decks, "airdesign_get_style", {})
  for (const { name } of listStyles()) await call(decks, "airdesign_get_style", { name })
  return largest
}

const statedBytes = {
  airdesign_execute: 20_000,
  airdesign_get_app_state: 1_000,
  airdesign_get_style: 8_000,
  airdesign_read_skill: 24_000,
  airdesign_stop_run: 1_000,
  airdesign_undo_run: 1_000,
}

it("keeps the largest answer of each tool on the eval decks under its stated size", async () => {
  const largest = await largestAnswers()
  expect(Object.keys(largest).sort()).toEqual(Object.keys(statedBytes))
  for (const [tool, stated] of Object.entries(statedBytes)) expect(largest[tool], tool).toBeLessThanOrEqual(stated)
})

it("holds every cap on what one call answers in one place", () => {
  expect({ ...budget }).toEqual({
    deckPage: 50,
    foundLines: 400,
    imagesPerCall: 10,
    namedIds: 5,
    readBytes: 24_000,
    resultChars: 20_000,
    scriptLimits: { ms: 20_000, memory: 64 * 1024 * 1024, stack: 1024 * 1024, logs: 50 },
    shotsPerCall: 4,
    shownFindings: 10,
  })
})
