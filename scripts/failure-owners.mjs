import { existsSync, readFileSync } from "node:fs"
import { posix } from "node:path"

export const journeysSpec = "tests/journeys/journeys.spec.ts"
export const journeysFolder = ".agents/skills/verify-airdesign/journeys"
const importedPath = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g
const extensions = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.mjs"]
const harnessFile = /^(?:tests|\.agents\/skills\/verify-airdesign)\//
const weightFile = /-seconds\.json$/
const browserConfig = /^playwright[\w.]*\.config\.m?ts$/

const readSource = (file) => (existsSync(file) ? readFileSync(file, "utf8") : undefined)

const resolveImport = (from, spec, read) => {
  const base = posix.join(posix.dirname(from), spec)
  const stems = [base, base.replace(/\.(m?js)$/, ".ts")]
  for (const stem of stems)
    for (const extension of extensions) {
      const candidate = `${stem}${extension}`
      if (read(candidate) !== undefined) return candidate
    }
  return undefined
}

export const importedFiles = (roots, read = readSource) => {
  const seen = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = read(file)
    if (source === undefined) continue
    for (const match of source.matchAll(importedPath)) {
      const resolved = resolveImport(file, match[1], read)
      if (resolved !== undefined && harnessFile.test(resolved)) queue.push(resolved)
    }
  }
  return seen
}

const journeyName = (test) => test.name.split(" › ").at(-1).trim()

export const ownedFailure = (test, files, read = readSource) => {
  const changed = files.filter((file) => !weightFile.test(file))
  const config = changed.find((file) => browserConfig.test(file))
  if (config !== undefined) return config
  const roots = [test.file]
  if (test.file === journeysSpec) {
    const journey = `${journeysFolder}/${journeyName(test)}.mjs`
    if (read(journey) !== undefined) roots.push(journey)
  }
  const reach = importedFiles(roots, read)
  return changed.find((file) => reach.has(file))
}
