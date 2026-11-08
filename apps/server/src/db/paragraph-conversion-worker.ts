import {parentPort, workerData} from "node:worker_threads"
import {transduceLegacyHistory, type LegacyHistoryArchiveV2} from "../../../../packages/change-log/src/text/history-transducer.ts"

const archives: LegacyHistoryArchiveV2[] = workerData
parentPort?.postMessage({kind: "started"})
const started = performance.now()
const converted = archives.map(archive => transduceLegacyHistory(archive))
parentPort?.postMessage({kind: "converted", archives: converted, conversionMs: performance.now() - started})
