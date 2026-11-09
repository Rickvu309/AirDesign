import type {Box, Deck, Element, Slide} from "../model.ts"
import {isId} from "../model.ts"
import {deckShape, elementShape, slideShape} from "../parse.ts"
import {isTextBody} from "./body-codec.ts"
import type {TextBody} from "./body.ts"

export type NativeText = Omit<Extract<Element, {kind: "text"}>, "runs"> & {body: TextBody}
export type NativeElement = Exclude<Element, {kind: "text"} | {kind: "group"}> | NativeText | (Omit<Extract<Element, {kind: "group"}>, "children"> & {children: NativeElement[]; coordinateSpace?: Box})
export type NativeSlide = Omit<Slide, "elements"> & {elements: NativeElement[]}
export type NativeDeck = Omit<Deck, "slides"> & {slides: NativeSlide[]}
export type NativeArchiveV3 = {version: 3; deck: NativeDeck}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
export function isNativeElement(value: unknown): value is NativeElement {
  if (record(value) && value.coordinateSpace !== undefined) {
    const space = value.coordinateSpace
    if (value.kind !== "group" || !record(space) || Object.keys(space).some(key => !["x", "y", "width", "height"].includes(key)) || ![space.x, space.y, space.width, space.height].every(value => typeof value === "number" && Number.isFinite(value)) || typeof space.width !== "number" || typeof space.height !== "number" || space.width <= 0 || space.height <= 0) return false
  }
  return elementShape(value, text => {
    if ("runs" in text) return false
    return isTextBody(text.body)
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
  const deck = input.deck
  function references(node: NativeSlide | NativeElement) {
    if (node.theme !== null && !deck.themes.some(theme => theme.id === node.theme)) throw new Error("invalid-theme-reference")
    if ("placeholder" in node && node.placeholder !== null && !deck.placeholders?.includes(node.placeholder)) throw new Error("invalid-placeholder-reference")
    if ("overlap" in node && node.overlap !== null && !deck.overlaps?.includes(node.overlap)) throw new Error("invalid-overlap-reference")
  }
  function visit(element: NativeElement) {
    references(element)
    reserve(element.id)
    if (element.kind === "group") element.children.forEach(visit)
    if (element.kind === "text") { reserve(element.body.frame.id); element.body.paragraphs.forEach(paragraph => reserve(paragraph.id)) }
  }
  reserve(input.deck.id)
  input.deck.slides.forEach(slide => { reserve(slide.id); references(slide); slide.elements.forEach(visit) })
  return structuredClone({version: 3, deck: input.deck})
}
