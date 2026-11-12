import { readFileSync } from "node:fs"
import { detectors } from "./detectors.mjs"

export const allowFile = new URL("./allow.json", import.meta.url)

export function pageMatches(pattern, name) {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${source}$`).test(name)
}

export function readAllow(text = readFileSync(allowFile, "utf8")) {
  const entries = JSON.parse(text)
  if (!Array.isArray(entries)) throw new Error("look/allow.json must hold a list of entries")
  return entries.map((entry, index) => {
    const where = `look/allow.json entry ${index + 1}`
    for (const field of ["page", "detector", "selector", "reason"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") throw new Error(`${where} needs a ${field}`)
    }
    if (!detectors.some((detector) => detector.name === entry.detector))
      throw new Error(`${where} names no detector: ${entry.detector}`)
    return { ...entry, index }
  })
}

export function staleEntries(entries, used) {
  return entries
    .filter((entry) => !used.has(entry.index))
    .map(
      (entry) =>
        `look/allow.json entry ${entry.index + 1} (${entry.page}, ${entry.detector}, ${entry.selector}) silences nothing. Remove it.`,
    )
}
