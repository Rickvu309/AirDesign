import type { DeckIndex, Register } from "@airdesign/document"
import { designedParts } from "@/index-deck"

type Parts = ReadonlyMap<string, Uint8Array>

const indexes = new WeakMap<Parts, DeckIndex>()

export function indexedRegister(parts: Parts, register: Register): Register {
  const held = register.index
  if (held !== undefined && held.total === held.elements.length) return register
  const kept = indexes.get(parts)
  if (kept !== undefined) return { ...register, index: kept }
  const { palettes, slides, elements } = designedParts(parts)
  const index: DeckIndex = {
    total: elements.length,
    slides,
    elements,
    ...(palettes === undefined ? {} : { palettes }),
    pages: [],
  }
  indexes.set(parts, index)
  return { ...register, index }
}
