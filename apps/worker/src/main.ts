import { ensureContainerWorker } from "./container-worker-ownership.ts"
import { runWorkerCycle } from "./worker-cycle.ts"
import { workerShutdown, isWorkerShutdown } from "./worker-shutdown.ts"

ensureContainerWorker()
const shutdown = workerShutdown()
try {
  await runWorkerCycle(shutdown.signal)
} catch (error) {
  if (!isWorkerShutdown(error, shutdown.signal)) throw error
} finally { shutdown.close() }
