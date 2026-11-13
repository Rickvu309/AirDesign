import { readTextValue } from "@airdesign/document"
import type { PaintStore } from "@airdesign/render"
import { airaCopy } from "@/copy/aira-copy"

type ReadDeck = Pick<PaintStore, "slides" | "getElement">

function hasWords(text: string): boolean {
  const value = readTextValue(text)
  if (value === null) return text.trim().length > 0
  return value.some((paragraph) => paragraph.runs.some((run) => run.text.trim().length > 0))
}

export function airaStarters(deck: ReadDeck): readonly string[] {
  const slides = deck.slides()
  if (slides.length === 0) return []
  const worded = slides.filter((slide) => slide.elements.some((id) => hasWords(deck.getElement(id)?.text ?? ""))).length
  return worded > 1 ? airaCopy.repairStarters : airaCopy.draftStarters
}
