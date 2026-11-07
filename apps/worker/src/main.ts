import { ensureContainerWorker } from "./container-worker-ownership.ts"
import { runWorkerCycle } from "./worker-cycle.ts"

ensureContainerWorker()
await runWorkerCycle()
