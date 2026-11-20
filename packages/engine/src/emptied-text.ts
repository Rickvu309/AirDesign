import {
  currentValue,
  elementGone,
  history,
  noCharacters,
  type Design,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { foldedElement, layerDesign } from "./read-element.js"

function shownPaint(read: Design[keyof Design]): boolean {
  const value = read?.[0]
  return value !== undefined && value !== "none" && !(typeof value === "string" && value.startsWith("hidden "))
}

function paintsWithoutWords(design: Design | undefined): boolean {
  if (design === undefined) return false
  return design.geometry !== undefined || shownPaint(design.fills) || shownPaint(design["border.fill"])
}

function wordsOf(register: Register, node: ElementId): string | null {
  const body = register.elements[node]
  if (body !== undefined && history(body).length > 0) return currentValue(body)
  return foldedElement(register, node)?.value ?? null
}

export function emptiedText(register: Register, node: ElementId): boolean {
  const layer = foldedElement(register, node)
  if (layer?.kind !== "shape" || layer.role !== undefined || elementGone(register, node)) return false
  const words = wordsOf(register, node)
  return words !== null && noCharacters(words) && !paintsWithoutWords(layerDesign(register, node))
}

export function emptiedNow(before: Register, after: Register): readonly ElementId[] {
  return after.nodes.filter((node) => {
    const was = wordsOf(before, node)
    return was !== null && !noCharacters(was) && emptiedText(after, node)
  })
}
