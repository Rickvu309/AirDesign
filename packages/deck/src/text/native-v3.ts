import type {Deck, Element, Slide} from "../model.ts"
import {parseDeck} from "../parse.ts"
import {parseTextBody} from "./body-codec.ts"
import type {TextBody} from "./body.ts"

export type NativeText = Omit<Extract<Element, {kind: "text"}>, "runs"> & {body: TextBody}
export type NativeElement = Exclude<Element, {kind: "text"} | {kind: "group"}> | NativeText | (Omit<Extract<Element, {kind: "group"}>, "children"> & {children: NativeElement[]})
export type NativeSlide = Omit<Slide, "elements"> & {elements: NativeElement[]}
export type NativeDeck = Omit<Deck, "slides"> & {slides: NativeSlide[]}
export type NativeArchiveV3 = {version: 3; deck: NativeDeck}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
export function parseNativeArchiveV3(input: unknown): NativeArchiveV3 {
  if (!record(input) || input.version !== 3 || !record(input.deck) || !Array.isArray(input.deck.slides) || Object.keys(input).some(key => !["version", "deck"].includes(key))) throw new Error("invalid-native-archive")
  const bodies = new Map<string, TextBody>()
  const ids = new Set<string>()
  function reserve(value: unknown) {
    if (typeof value !== "string" || ids.has(value)) throw new Error("duplicate-native-node-id")
    ids.add(value)
  }
  function element(value: unknown): unknown {
    if (!record(value)) throw new Error("invalid-native-element")
    reserve(value.id)
    if (value.kind === "text") {
      if ("runs" in value) throw new Error("legacy-text-in-native-archive")
      const body = parseTextBody(value.body)
      reserve(body.frame.id)
      body.paragraphs.forEach(paragraph => reserve(paragraph.id))
      bodies.set(String(value.id), body)
      const {body: discarded, ...base} = value
      void discarded
      return {...base, runs: [{text: "", font: "Geist", size: 1, color: "#000000", bold: false}]}
    }
    if ("body" in value || "runs" in value) throw new Error("text-fields-on-nontext-element")
    if (value.kind === "group") {
      if (!Array.isArray(value.children)) throw new Error("invalid-native-group")
      return {...value, children: value.children.map(element)}
    }
    return value
  }
  reserve(input.deck.id)
  const slides = input.deck.slides.map(slide => {
    if (!record(slide) || !Array.isArray(slide.elements)) throw new Error("invalid-native-slide")
    reserve(slide.id)
    return {...slide, elements: slide.elements.map(element)}
  })
  const legacy = parseDeck({...input.deck, slides})
  function restore(value: Element): NativeElement {
    if (value.kind === "group") return {...value, children: value.children.map(restore)}
    if (value.kind !== "text") return value
    const {runs, ...base} = value
    void runs
    const body = bodies.get(value.id)
    if (!body) throw new Error("missing-native-body")
    return {...base, body}
  }
  return structuredClone({version: 3, deck: {...legacy, slides: legacy.slides.map(slide => ({...slide, elements: slide.elements.map(restore)}))}})
}
