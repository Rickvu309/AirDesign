import type { DeckIndex, Register } from "@airdesign/document"
import { indexPackage } from "./index-package.js"

type Parts = ReadonlyMap<string, Uint8Array>

const tagPart = /^ppt\/tags\/tag[0-9]{1,9}\.xml$/
const filed = new WeakMap<Parts, DeckIndex>()

function fileIndex(parts: Parts): DeckIndex {
  const kept = filed.get(parts)
  if (kept !== undefined) return kept
  const { slides, elements } = indexPackage(parts)
  const index: DeckIndex = { total: elements.length, slides, elements, pages: [] }
  filed.set(parts, index)
  return index
}

export function withFiledFrames(parts: Parts, register: Register): Register {
  const held = register.index
  if (held !== undefined && held.total === held.elements.length) return register
  if (![...parts.keys()].some((name) => tagPart.test(name))) return register
  return { ...register, index: fileIndex(parts) }
}
