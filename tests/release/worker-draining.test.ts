import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"
import { workerShutdownDeadlineMs } from "../../apps/worker/src/worker-shutdown.ts"

it("gives the production worker more draining time than its own shutdown deadline", async () => {
  const config = await readFile(".railway/railway.ts", "utf8")
  const worker = config.slice(config.indexOf('service("worker"'))
  const draining = /RAILWAY_DEPLOYMENT_DRAINING_SECONDS: "(\d+)"/.exec(worker.slice(0, worker.indexOf("});")))
  expect(draining, "Railway defaults draining to 0 s, which sends SIGKILL right after SIGTERM and skips the worker's graceful stop").not.toBeNull()
  expect(Number(draining?.[1]) * 1000).toBeGreaterThan(workerShutdownDeadlineMs + 1000)
})
