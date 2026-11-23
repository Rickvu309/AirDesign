import { limits } from "@airdesign/doom"

import { storableText } from "./storable-text.js"

export function readDeckName(raw: unknown): string | undefined {
  if (!storableText(raw)) return undefined
  const name = raw.trim()
  const size = [...name].length
  if (size < 1 || size > limits.name) return undefined
  return name
}

export function deckName(fileName: string): string {
  const stem = fileName.replace(/\.pptx$/i, "").trim()
  return readDeckName([...stem].slice(0, limits.name).join("")) ?? ""
}
