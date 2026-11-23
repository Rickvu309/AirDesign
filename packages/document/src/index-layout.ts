import type { IndexElement } from "./deck-index.js"
import { bytesOf } from "@airdesign/doom"
import { onlyKeys, record } from "./plain-object.js"

export type IndexLayout = {
  readonly part: string
  readonly name: string
  readonly floor: readonly IndexElement[]
}

export const layoutLimit = 64

const layoutPartPattern = /^ppt(?:\/[A-Za-z0-9_-]{1,100}){1,4}\.xml$/
const unwritable = /[\u0000\p{Cs}]/u

export function readLayoutPart(raw: unknown): string | undefined {
  return typeof raw === "string" && layoutPartPattern.test(raw) ? raw : undefined
}

export function readIndexLayouts(
  raw: unknown,
  readFloor: (raw: unknown) => readonly IndexElement[] | null,
): readonly IndexLayout[] | null {
  if (!Array.isArray(raw) || raw.length > layoutLimit) return null
  const layouts: IndexLayout[] = []
  for (const item of raw) {
    const row = record(item)
    if (row === null || !onlyKeys(row, ["part", "name", "floor"])) return null
    const part = readLayoutPart(row.part)
    const floor = readFloor(row.floor)
    if (part === undefined || floor === null || layouts.some((kept) => kept.part === part)) return null
    if (typeof row.name !== "string" || bytesOf(row.name) > 256 || unwritable.test(row.name)) return null
    layouts.push({ part, name: row.name, floor })
  }
  return layouts
}
