import { setTimeout as pause } from "node:timers/promises"

export type HistorySchemaWaitPolicy = { budgetMs: number; firstDelayMs: number; maxDelayMs: number }

export const workerHistorySchemaWait: HistorySchemaWaitPolicy = { budgetMs: 180_000, firstDelayMs: 250, maxDelayMs: 15_000 }

export class HistorySchemaOutdated extends Error {
  readonly expected: number
  readonly found: number
  constructor(expected: number, found: number) {
    super(`history-schema-outdated: expected version ${expected}, found ${found}. Start the web service to run database migrations before starting the worker`)
    this.expected = expected
    this.found = found
  }
}

export async function waitForHistorySchema(read: () => Promise<number>, expected: number, policy: HistorySchemaWaitPolicy, clock: () => number) {
  const started = clock()
  for (let attempt = 1; ; attempt++) {
    const found = await read()
    if (found >= expected) return
    const ceiling = Math.min(policy.maxDelayMs, policy.firstDelayMs * 2 ** (attempt - 1))
    const retryInMs = Math.round(ceiling / 2 + Math.random() * ceiling / 2)
    if (clock() - started + retryInMs > policy.budgetMs) throw new HistorySchemaOutdated(expected, found)
    process.stderr.write(JSON.stringify({ event: "history-schema-waiting", expected, found, attempt, retryInMs }) + "\n")
    await pause(retryInMs)
  }
}
