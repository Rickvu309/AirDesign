import { expect, expectTypeOf, it, vi } from "vitest"
import type { createHistoryStore } from "../src/db/history-store.ts"
import { HistorySchemaOutdated, waitForHistorySchema, type HistorySchemaWaitPolicy } from "../src/db/history-schema-wait.ts"

type HistoryDriver = Parameters<typeof createHistoryStore>[0]

it("admits a wait policy only on worker connect drivers", () => {
  expectTypeOf<{ kind: "postgres"; url: string; schema: "connect"; wait: HistorySchemaWaitPolicy }>().toMatchTypeOf<HistoryDriver>()
  expectTypeOf<{ kind: "postgres"; url: string; wait: HistorySchemaWaitPolicy }>().not.toMatchTypeOf<HistoryDriver>()
  expectTypeOf<{ kind: "postgres"; url: string; schema: "migrate"; wait: HistorySchemaWaitPolicy }>().not.toMatchTypeOf<HistoryDriver>()
})

it("spends the last partial interval of the budget and sees a migration that lands in it", async () => {
  const lines: string[] = []
  vi.spyOn(process.stderr, "write").mockImplementation(chunk => { lines.push(String(chunk)); return true })
  const versions = [0, 1]
  try {
    await waitForHistorySchema(async () => versions.shift() ?? 1, 1, { budgetMs: 40, firstDelayMs: 1_000, maxDelayMs: 1_000 }, Date.now)
  } finally { vi.restoreAllMocks() }
  const waits = lines.map(line => JSON.parse(line))
  expect(waits).toHaveLength(1)
  expect(waits[0]).toMatchObject({ event: "history-schema-waiting", expected: 1, found: 0, attempt: 1 })
  expect(waits[0].retryInMs).toBeGreaterThan(0)
  expect(waits[0].retryInMs).toBeLessThanOrEqual(40)
})

it("throws the typed outdated error once the budget is spent", async () => {
  vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    const failure = await waitForHistorySchema(async () => 0, 1, { budgetMs: 30, firstDelayMs: 10, maxDelayMs: 10 }, Date.now).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(HistorySchemaOutdated)
    expect(failure).toMatchObject({ expected: 1, found: 0 })
  } finally { vi.restoreAllMocks() }
})
