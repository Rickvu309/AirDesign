import fs from "node:fs"
import { parentPort, workerData } from "node:worker_threads"
import { loadedPptx, writtenRouteFiles } from "./pptx-route-judge.mjs"

const { root, file, directory, prefix } = workerData
const pptx = await loadedPptx(root)
const original = fs.readFileSync(file)
parentPort.postMessage(await writtenRouteFiles(pptx, original, await pptx.readParts(original), directory, prefix))
