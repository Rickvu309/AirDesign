import { contentTypesPart, presentationPart, presentationRels, relsOf } from "./package-address.js"
import { copyOwnedParts } from "./owned-parts.js"
import { nextSlideFile } from "./slide-list-route.js"
import { onlyNotes } from "./slide-notes.js"

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
  const rels = parts.get(relsOf(source))
  if (rels === undefined) return added
  const written = new Map(parts)
  copyOwnedParts(written, source, added.added[0] ?? "", rels)
  const copies = [...written.keys()].filter((name) => !parts.has(name))
  return { ...added, added: [...added.added, ...copies] }
}

export function removedSlideTouch(parts: ReadonlyMap<string, Uint8Array>, part: string): PartTouch {
  const notes = onlyNotes(parts, part)
  const dropped = notes === null ? [] : [notes, ...(parts.has(relsOf(notes)) ? [relsOf(notes)] : [])]
  return { changed: listed, added: [], removed: [part, relsOf(part), ...dropped] }
}
