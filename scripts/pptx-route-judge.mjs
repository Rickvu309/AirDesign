import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Worker } from "node:worker_threads"

export async function loadedPptx(root) {
  const pptx = await import(pathToFileURL(path.join(root, "packages/pptx/dist/index.js")).href)
  const require = createRequire(path.join(root, "packages/pptx/package.json"))
  await pptx.prepareMarkup(fs.readFileSync(require.resolve("sax-wasm/lib/sax-wasm.wasm")))
  return pptx
}

export async function writtenRouteFiles(pptx, original, parts, directory, prefix) {
  const files = []
  for (const run of pptx.routeRuns(parts)) {
    if (run.error !== null || run.parts === null || run.touch === null) {
      files.push({ run, file: null, back: null, exportError: null })
      continue
    }
    const name = `${prefix}-${run.operation.replaceAll(".", "-")}.pptx`
    try {
      const packed = await pptx.exportPackage(original, run.parts)
      const file = path.join(directory, name)
      fs.writeFileSync(file, packed)
      files.push({ run, file, back: await pptx.readParts(packed), exportError: null })
    } catch (error) {
      files.push({
        run,
        file: null,
        back: null,
        exportError: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return files
}

export function writtenRouteFilesInThread(workerData) {
  return new Promise((resolve, reject) => {
    const thread = new Worker(new URL("./route-write-thread.mjs", import.meta.url), { workerData })
    thread.once("message", resolve)
    thread.once("error", reject)
    thread.once("exit", (code) => reject(new Error(`route writes for ${workerData.file} stopped with code ${code}`)))
  })
}

export function missingOperations(pptx, runs) {
  const have = new Set(runs.map((run) => run.operation))
  return pptx.routeOperations.filter((operation) => !have.has(operation))
}

export function passedWrites(decks) {
  const passedRoutes = new Set()
  let decksPassed = 0
  for (const deck of decks) {
    const byRoute = new Map()
    for (const run of deck.runs) {
      const row = byRoute.get(run.route) ?? { ok: true }
      if (run.passed !== true) row.ok = false
      byRoute.set(run.route, row)
    }
    let deckOk = byRoute.size > 0 && deck.missing !== true
    for (const [route, row] of byRoute) {
      if (!row.ok) deckOk = false
      else passedRoutes.add(route)
    }
    if (deckOk) decksPassed += 1
  }
  return { routes: passedRoutes.size, decks: decksPassed }
}

export function scoreWrittenRoute(pptx, beforeParts, beforeErrors, item, afterErrors) {
  if (item.run.error !== null) return { operation: item.run.operation, error: item.run.error }
  if (item.exportError !== null) return { operation: item.run.operation, error: item.exportError }
  if (item.back === null || item.run.touch === null || afterErrors === undefined) {
    return { operation: item.run.operation, error: "export" }
  }
  const errors = pptx.newValidatorErrors(beforeErrors, afterErrors)
  const dupes = pptx.newDuplicateShapeIds(pptx.shapeIdCounts(beforeParts), pptx.shapeIdCounts(item.back))
  const partsMatch = pptx.touchMatches(beforeParts, item.back, item.run.touch)
  if (errors.length === 0 && dupes.length === 0 && partsMatch) return null
  return {
    operation: item.run.operation,
    errors: errors.length,
    dupes: dupes.length,
    parts: partsMatch,
    firstError: errors[0] ?? null,
  }
}
