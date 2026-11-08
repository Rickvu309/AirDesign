import type {Deck, Element, Slide} from "../model.ts"
import {isId} from "../model.ts"
import {deckShape, elementShape, slideShape} from "../parse.ts"
import {parseTextBody} from "./body-codec.ts"
import type {TextBody} from "./body.ts"

export type NativeText = Omit<Extract<Element, {kind: "text"}>, "runs"> & {body: TextBody}
export type NativeElement = Exclude<Element, {kind: "text"} | {kind: "group"}> | NativeText | (Omit<Extract<Element, {kind: "group"}>, "children"> & {children: NativeElement[]})
export type NativeSlide = Omit<Slide, "elements"> & {elements: NativeElement[]}
export type NativeDeck = Omit<Deck, "slides"> & {slides: NativeSlide[]}
export type NativeArchiveV3 = {version: 3; deck: NativeDeck}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
export function isNativeElement(value: unknown): value is NativeElement {
  return elementShape(value, text => {
    if ("runs" in text) return false
    try { parseTextBody(text.body); return true } catch { return false }
  }, isNativeElement) && record(value) && (value.kind === "text" || !("runs" in value || "body" in value))
}
export function isNativeSlide(value: unknown): value is NativeSlide { return slideShape(value, isNativeElement) }
export function isNativeDeck(value: unknown): value is NativeDeck { return deckShape(value, isNativeSlide) }
export function parseNativeArchiveV3(input: unknown): NativeArchiveV3 {
  if (!record(input) || input.version !== 3 || !isNativeDeck(input.deck)) throw new Error("invalid-native-archive-v3")
  const used = new Set<string>()
  function reserve(value: unknown) {
    if (!isId(value) || used.has(value)) throw new Error("duplicate-native-node-id")
    used.add(value)
  }
  function visit(element: NativeElement) {
    reserve(element.id)
    if (element.kind === "group") element.children.forEach(visit)
    if (element.kind === "text") { reserve(element.body.frame.id); element.body.paragraphs.forEach(paragraph => reserve(paragraph.id)) }
  }
  reserve(input.deck.id)
  input.deck.slides.forEach(slide => { reserve(slide.id); slide.elements.forEach(visit) })
  return structuredClone({version: 3, deck: input.deck})
}
