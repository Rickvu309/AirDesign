import type { Register } from "@airdesign/document"
import {
  danglingShapeReferences,
  deckDiff,
  exportPackage,
  newDanglingShapeReferences,
  newDuplicateShapeIds,
  newNotesLinkFailures,
  newSharedOwnedParts,
  partCopies,
  readParts,
  readSlides,
  shapeIdCounts,
  sharedOwnedParts,
} from "@airdesign/pptx"
import { expect, it } from "vitest"
import { importedDeck, type Parts } from "@/corpus-deck"
import { corpusEdits, corpusMedia } from "@/corpus-edits"
import { exportedParts } from "@/editing/exported-parts"
import { slideRels } from "@/editing/slide-paint"

declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    writeFileSync(path: string, data: Uint8Array | string): void
  }
}

const fs = process.getBuiltinModule("node:fs")
const fixtures = new URL("../../../scripts/pptx-fixtures/", import.meta.url).pathname
const decks = process.env.CORPUS_EDITS_DECKS?.split(",") ?? [`${fixtures}census-updating-spm.pptx`]
const out = process.env.CORPUS_EDITS_OUT
const picture = new Map([[corpusMedia.sha256, new Uint8Array(fs.readFileSync(`${fixtures}picture.png`))]])

function baseName(file: string, extension = ""): string {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(extension) ? name.slice(0, name.length - extension.length) : name
}

function slideCopies(before: Parts, after: Parts, register: Register): ReadonlyMap<string, string> {
  const copies = new Map(partCopies(before, after))
  const was = new Map(readSlides(before).map((row) => [row.slide, row.part]))
  const now = new Map(readSlides(after).map((row) => [row.slide, row.part]))
  const sources = new Map<string, string>()
  for (const command of register.order) if (command.slide === "clone") sources.set(command.id, command.source)
  for (const [copy, from] of sources) {
    let source: string | undefined = from
    while (source !== undefined && !was.has(source)) source = sources.get(source)
    const part = now.get(copy)
    const origin = source === undefined ? undefined : was.get(source)
    if (part !== undefined && origin !== undefined && !before.has(part)) copies.set(part, origin)
  }
  return copies
}

function allowed(names: readonly string[]): (part: string) => boolean {
  return (part) => names.some((name) => (name.endsWith("/") ? part.startsWith(name) : part === name))
}

function gone(before: Parts, after: Parts): readonly string[] {
  const kept = new Set(readSlides(after).map((row) => row.slide))
  const dropped = readSlides(before).filter((row) => !kept.has(row.slide))
  return dropped.length === 0 ? [] : [...dropped.flatMap((row) => [row.part, slideRels(row.part)]), "ppt/notesSlides/"]
}

function breaks(before: Parts, after: Parts, touches: readonly string[], copies: ReadonlyMap<string, string>) {
  const diff = deckDiff(before, after)
  const may = allowed(touches)
  const removable = allowed(gone(before, after))
  const dupes = newDuplicateShapeIds(shapeIdCounts(before), shapeIdCounts(after), copies)
  const dangling = newDanglingShapeReferences(danglingShapeReferences(before), danglingShapeReferences(after))
  return [
    ...diff.changed.filter((part) => !may(part) && !removable(part)).map((part) => `changed ${part}`),
    ...diff.removed.filter((part) => !removable(part)).map((part) => `removed ${part}`),
    ...dupes.map((row) => `duplicate id ${row.id} in ${row.part}`),
    ...dangling.map((row) => `dangling ${JSON.stringify(row)}`),
    ...newSharedOwnedParts(sharedOwnedParts(before), sharedOwnedParts(after)).map((row) => `shared ${row.part}`),
    ...newNotesLinkFailures(before, after).map((row) => `notes ${JSON.stringify(row)}`),
  ]
}

const named = decks.map((file) => ({ file, name: baseName(file) }))

it.each(named)("keeps $name whole after each edit people make most", { timeout: 600_000 }, async ({ file }) => {
  const original = new Uint8Array(fs.readFileSync(file))
  const parts = await readParts(original)
  const deck = baseName(file, ".pptx")
  const opened = importedDeck(parts)
  const found: string[] = []
  const written: { deck: string; edit: string; file: string; copies: [string, string][] }[] = []
  for (const edit of corpusEdits) {
    try {
      const register = edit.run(parts, opened).register
      const packed = await exportPackage(original, exportedParts(parts, register, picture))
      const back = await readParts(packed)
      const copies = slideCopies(parts, back, register)
      found.push(...breaks(parts, back, edit.touches(parts), copies).map((line) => `${edit.name}: ${line}`))
      if (out === undefined) continue
      const name = `${out}/${deck}--${edit.name}.pptx`
      fs.writeFileSync(name, packed)
      written.push({ deck: `${deck}.pptx`, edit: edit.name, file: name, copies: [...copies] })
    } catch (error) {
      found.push(`${edit.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (out !== undefined) fs.writeFileSync(`${out}/${deck}.json`, JSON.stringify(written))
  expect(found).toEqual([])
})
