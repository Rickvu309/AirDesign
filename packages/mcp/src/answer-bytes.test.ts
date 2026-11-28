import { callTool, guides, type Answer, type Session } from "@airdesign/agent"
import { evalDeckId, memoryDecks, suite } from "@airdesign/agent/testing/evals"
import { styles } from "@airdesign/taste"
import { expect, it } from "vitest"

import { encode } from "./encode.js"

const sizeOf = (answer: Answer) => Buffer.byteLength(JSON.stringify(encode(answer)))

async function largestAnswers(): Promise<Readonly<Record<string, number>>> {
  const largest: Record<string, number> = {}
  let calls = 0
  const session: Session = { agent: "eval", mint: () => `call${String((calls += 1))}` }
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
  const skillIndex = await call(decks, "airdesign_read_skill", {})
  expect(JSON.stringify(encode(skillIndex))).not.toContain("principles/")
  for (const { name } of guides()) await call(decks, "airdesign_read_skill", { name })
  await call(decks, "airdesign_get_style", {})
  for (const { id: name } of styles) await call(decks, "airdesign_get_style", { name })
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

async function executeFieldBytes(): Promise<readonly number[]> {
  const sizes: number[] = []
  for (const row of suite) {
    let calls = 0
    const session: Session = { agent: "eval", mint: () => `call${String((calls += 1))}` }
    const start = row.task.deck()
    const decks = memoryDecks(() => start, new Map([[evalDeckId, start]]))
    for (const step of row.reference) {
      const answer = await callTool(step.name, step.raw, session, decks)
      if (step.name === "airdesign_execute") sizes.push(Buffer.byteLength(JSON.stringify(answer.fields)))
    }
  }
  return sizes
}

it("keeps the mean execute answer of the eval references 15% under its 340.82 bytes before answers were trimmed", async () => {
  const sizes = await executeFieldBytes()
  expect(sizes).toHaveLength(50)
  expect(sizes.reduce((sum, size) => sum + size, 0) / sizes.length).toBeLessThanOrEqual(340.82 * 0.85)
})
