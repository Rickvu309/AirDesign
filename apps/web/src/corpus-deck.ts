import { readDeckId, readSetChange } from "@airdesign/catalog"
import {
  bytesOf,
  formatOne,
  limits,
  planChange,
  presentSlides,
  readTextValue,
  valueHolder,
  writeTextValue,
  type Box,
  type ElementId,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { call, indexDeck, openDeck, type Deck } from "@airdesign/engine"
import { indexPages } from "@airdesign/live"
import { paintReader, readShapes, readSlides, type ReadShape } from "@airdesign/pptx"
import { deviceScope, valueFits } from "@/design/trait-edit"
import { boxStorable, paintedBox } from "@/editing/element-move"
import { indexedParts } from "@/editing/index-deck"
import { fileSlides, slideCommand, type SlideChange } from "@/editing/slide-edit"
import { flooredEdit } from "@/editing/slide-floor"
import { newSlideLayout } from "@/editing/slide-layout"

export type Parts = ReadonlyMap<string, Uint8Array>

export type Held = {
  readonly node: ElementId
  readonly part: string
  readonly kind: string
  readonly floor: string
  readonly typed: string | null
  readonly box: Box | null
}

const person = { actor: "person" } as const
const deckName = "deck"
const held = new WeakMap<Parts, readonly Held[]>()

export function commit(deck: Deck, batch: readonly unknown[]): Deck {
  const result = call("commit_edits", deck, person, { deck: deckName, batch })
  if (!result.ok) throw new Error(`refused ${result.refusal}`)
  return result.deck
}

export function commitEach(deck: Deck, batch: readonly unknown[]): Deck {
  return batch.reduce<Deck>((next, edit) => commit(next, [edit]), deck)
}

export function importedDeck(parts: Parts): Deck {
  const id = readDeckId(deckName)
  if (!id.ok) throw new Error(id.refusal)
  let count = 0
  const split = indexPages(indexedParts(parts), () => `page${String((count += 1))}`)
  if (!split.ok) throw new Error(split.refusal)
  return split.pages.reduce((deck, page) => {
    const next = indexDeck(deck, person, { deck: deckName, ...page })
    if (!next.ok) throw new Error(`index ${next.refusal}`)
    return next.deck
  }, openDeck(id.deck))
}

export function slideWire(parts: Parts, register: Register, edit: SlideCommand | null): unknown {
  if (edit === null) throw new Error("no slide edit")
  return { ...edit, file: fileSlides(parts, register) }
}

export function slideCount(parts: Parts, deck: Deck): number {
  return presentSlides({ ...deck.register, file: fileSlides(parts, deck.register) }).length
}

export function slideEdit(parts: Parts, deck: Deck, change: SlideChange, index: number, to = index): Deck {
  const register = deck.register
  const file = fileSlides(parts, register)
  const state = { ...register, file }
  const current = presentSlides(state)[index]
  const layout = change === "add" && current !== undefined ? newSlideLayout(parts, state, current.id) : undefined
  const built = slideCommand(state, change, index, to, layout)
  if (built === null) throw new Error(`no ${change}`)
  return commit(deck, [{ ...flooredEdit(parts, register, file, built.edit), file }])
}

export function slideRoom(parts: Parts) {
  const text = new TextDecoder().decode(parts.get("ppt/presentation.xml"))
  const size = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(text)
  return { width: Number(size?.[1] ?? 12_192_000), height: Number(size?.[2] ?? 6_858_000) }
}

function typedValue(parts: Parts, shape: ReadShape, value: string): string | null {
  const text = readTextValue(value)
  if (text === null) return null
  for (const [line, paragraph] of text.entries()) {
    for (const [at, run] of paragraph.runs.entries()) {
      if (run.text.length === 0) continue
      const runs = paragraph.runs.map((each, spot) => (spot === at ? { ...each, text: `${each.text} typed` } : each))
      const written = writeTextValue(text.map((each, spot) => (spot === line ? { ...each, runs } : each)))
      if (bytesOf(written) <= limits.valueBytes && valueFits(parts, shape, written)) return written
    }
  }
  return null
}

export function heldElements(parts: Parts): readonly Held[] {
  const kept = held.get(parts)
  if (kept !== undefined) return kept
  const shapes = new Map(readShapes(parts).map((shape) => [`${shape.slide}.${shape.shape}`, shape]))
  const reader = paintReader(parts)
  const rows = indexedParts(parts).elements.flatMap((element): Held[] => {
    const shape = shapes.get(element.node)
    if (element.grouped || shape === undefined) return []
    const floor = typeof element.value === "string" ? element.value : ""
    if (bytesOf(floor) > limits.valueBytes) return []
    const typed = element.kind === "shape" && floor.length > 0 ? typedValue(parts, shape, floor) : null
    const painted = reader
      .slide(shape.part)
      .elements.find((each) => each.from === "slide" && each.shape === shape.shape)
    const drawn = painted?.box ? [{ id: element.node, box: painted.box }] : []
    const box = boxStorable(parts, shape) ? (element.box ?? paintedBox({ elements: drawn }, element.node)) : null
    return [{ node: element.node, part: shape.part, kind: element.kind, floor, typed, box }]
  })
  held.set(parts, rows)
  return rows
}

export function textTarget(parts: Parts): Held & { readonly typed: string; readonly box: Box } {
  for (const row of heldElements(parts)) {
    if (row.typed !== null && row.box !== null) return { ...row, typed: row.typed, box: row.box }
  }
  throw new Error("no text box a person can type in and move")
}

export function panelChange(
  parts: Parts,
  deck: Deck,
  target: Pick<Held, "node" | "floor">,
  change: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Deck {
  const read = readSetChange({ op: "set", target: target.node, ...change })
  if (!read.ok) throw new Error(`read ${read.refusal}`)
  const planned = planChange(read.change, deviceScope(parts, deck.register))
  if (!planned.ok) return deck
  const holder = valueHolder(target.node)
  const batch = planned.rows.flatMap(({ node, row }) =>
    (formatOne(row.patch, holder) ?? [row]).map((each) => ({ node, floor: target.floor, ...each })),
  )
  const fits = batch.every(
    (edit) => !("value" in edit) || typeof edit.value !== "string" || bytesOf(edit.value) <= limits.valueBytes,
  )
  return fits ? commit(deck, batch) : deck
}

export function slidePart(parts: Parts, index: number): string {
  const part = readSlides(parts)[index]?.part
  if (part === undefined) throw new Error("no slide")
  return part
}
