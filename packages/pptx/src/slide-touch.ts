import { contentTypesPart, presentationPart, presentationRels, relsOf } from "./package-address.js"
import { nextSlideFile } from "./slide-list-route.js"
import { notesCopy, onlyNotes } from "./slide-notes.js"

export type PartTouch = {
  readonly changed: readonly string[]
  readonly added: readonly string[]
  readonly removed: readonly string[]
}

const listed = [presentationPart, presentationRels, contentTypesPart]

export function addedSlideTouch(parts: ReadonlyMap<string, Uint8Array>): PartTouch {
  const part = `ppt/slides/slide${nextSlideFile(parts)}.xml`
  return { changed: listed, added: [part, relsOf(part)], removed: [] }
}

export function clonedSlideTouch(parts: ReadonlyMap<string, Uint8Array>, source: string): PartTouch {
  const added = addedSlideTouch(parts)
  const copy = notesCopy(parts, source)
  if (copy === null) return added
  return { ...added, added: [...added.added, copy.to, ...(copy.rels ? [relsOf(copy.to)] : [])] }
}

export function removedSlideTouch(parts: ReadonlyMap<string, Uint8Array>, part: string): PartTouch {
  const notes = onlyNotes(parts, part)
  const dropped = notes === null ? [] : [notes, ...(parts.has(relsOf(notes)) ? [relsOf(notes)] : [])]
  return { changed: listed, added: [], removed: [part, relsOf(part), ...dropped] }
}
