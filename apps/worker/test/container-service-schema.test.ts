import { expect, it, vi } from "vitest"
import { HistorySchemaOutdated, waitForHistorySchema } from "../../server/src/db/history-schema-wait.ts"

vi.mock("../src/container-worker-ownership.ts", () => ({ ensureContainerWorker: () => undefined }))
vi.mock("../src/worker-cycle.ts", () => ({
  runWorkerCycle: async () => waitForHistorySchema(async () => 0, 1, { budgetMs: 0, firstDelayMs: 250, maxDelayMs: 15_000 }, Date.now),
}))

it("ends the container service visibly when the cycle exhausts its schema wait budget", async () => {
  vi.stubEnv("AIRDESIGN_ISOLATION", "container")
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/unused")
  vi.stubEnv("AIRDESIGN_OPERATIONS_PATH", "unused.sqlite")
  vi.stubEnv("AIRDESIGN_WORKER_API_ORIGIN", "http://localhost")
  vi.stubEnv("AIRDESIGN_SECRET", "test-secret-at-least-32-characters")
  try {
    await expect(import("../src/service.ts")).rejects.toThrow(HistorySchemaOutdated)
  } finally {
    vi.unstubAllEnvs()
  }
})
