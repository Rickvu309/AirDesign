import {isDeepStrictEqual} from "node:util"
import type {Id} from "../../../deck/src/model.ts"
import type {TextBody} from "../../../deck/src/text/body.ts"
import type {NativeDeck, NativeElement} from "../../../deck/src/text/native-v3.ts"
import {flatten} from "../../../deck/src/elements.ts"
import {importPptx, type Presentation} from "../index.ts"
import {importedDeck, importedNativeDeck} from "../import-deck.ts"
import {parseXml} from "../xml.ts"
import {replaceTextBody, readTextBody} from "./body.ts"
import {textContext, UnsupportedTextFormat} from "./cascade.ts"
import {bodyFormatting, preserveLegacySourceV2} from "./legacy-source-v2.ts"

export function patchNativeSourceText(source: Presentation, original: Presentation, part: string, objectId: string, identity: Id, previous: TextBody, next: TextBody): Presentation {
  const bytes = source.parts.get(part)
  if (!bytes) throw new UnsupportedTextFormat("source part required")
  const retained = parseXml(bytes), bodies = retained.nodes.filter(node => node.local === "txBody")
  const ordinal = objectId.startsWith("body:") ? Number(objectId.split(":")[1]) : bodies.findIndex(node => retained.nodes.filter(node => node.local === "t" && node.uri.endsWith("/drawingml/2006/main")).some((span, index) => index === Number(objectId.split(":")[1]?.split(",")[0]) && span.start > node.start && span.end < node.end))
  const parsed = parseXml(original.parts.get(part)!), body = parsed.nodes.filter(node => node.local === "txBody")[ordinal]
  if (!body) throw new UnsupportedTextFormat("source text body required")
  const shape = parsed.nodes.find(node => node.local === "sp" && node.start < body.start && node.end > body.end)
  if (!shape) throw new UnsupportedTextFormat("source text shape required")
  const context = textContext(original, part, parsed, shape)
  const replacement = replaceTextBody(parsed, body, next, previous), checked = parseXml(Buffer.from(replacement))
  const nextBody = checked.nodes.filter(node => node.local === "txBody")[ordinal]
  if (!nextBody) throw new UnsupportedTextFormat("selective body structure")
  const projected = readTextBody(checked, nextBody, identity, context)
  const semantics = (body: typeof projected): unknown => JSON.parse(JSON.stringify(bodyFormatting(body), (key, value: unknown) => {
    if (key === "style" || key === "endStyle") {
      if (!value || typeof value !== "object") throw new Error("text-style-required")
      return Object.fromEntries(Object.entries({italic: false, underline: false, strike: false, letterSpacing: 0, baseline: 0, kerning: 0, opacity: 1, capitalization: "none", ...value}).sort(([a], [b]) => a.localeCompare(b)))
    }
    return value
  }))
  if (!isDeepStrictEqual(semantics(projected), semantics(next))) throw new UnsupportedTextFormat("selective edit projection differs")
  return {...original, parts: new Map(original.parts).set(part, Buffer.from(replacement))}
}
export async function assertNativeSourceTextEdits(bytes: Buffer, deck: NativeDeck, previousDeck?: NativeDeck): Promise<void> {
  const original = await importPptx(bytes), native = importedNativeDeck(original), legacy = importedDeck(original)
  const topology = (elements: NativeElement[], parent = ""): unknown[] => elements.flatMap(element => element.source.kind !== "original" ? [] : [{id: element.id, kind: element.kind, source: element.source.objectId, parent}, ...(element.kind === "group" ? topology(element.children, element.id) : [])])
  for (const slide of deck.slides) {
    if (slide.source.kind !== "original") continue
    const source = slide.source, before = (previousDeck ?? native).slides.find(candidate => candidate.source.kind === "original" && candidate.source.part === source.part)
    if (before && !isDeepStrictEqual(topology(before.elements), topology(slide.elements))) throw new UnsupportedTextFormat("source topology")
  }
  for (const slide of deck.slides) for (const element of flatten(slide.elements)) {
    if (element.source.kind !== "original") continue
    const source = element.source
    const oldSlide = native.slides.find(slide => slide.source.kind === "original" && slide.source.part === source.part)
    const previous = oldSlide && flatten(oldSlide.elements).find(element => element.source.kind === "original" && element.source.objectId === source.objectId)
    if (previous && element.support.kind === "native") {
      if (!isDeepStrictEqual(previous.box, element.box)) throw new UnsupportedTextFormat("source geometry")
      if (element.kind === "group" && "coordinateSpace" in element) {
        if (previous.kind !== "group" || !isDeepStrictEqual(previous.coordinateSpace, element.coordinateSpace) || !isDeepStrictEqual(previous.children.map(child => child.source), element.children.map(child => child.source))) throw new UnsupportedTextFormat("source group coordinates or topology")
      }
      const ancestry = (elements: typeof slide.elements) => flatten(elements).filter(parent => parent.kind === "group" && flatten(parent.children).some(child => child.source.kind === "original" && child.source.objectId === source.objectId)).map(parent => parent.source)
      if (oldSlide && !isDeepStrictEqual(ancestry(oldSlide.elements), ancestry(slide.elements))) throw new UnsupportedTextFormat("source group ancestry")
    }
    if (element.kind !== "text") continue
    if (source.textVersion === 2) {
      const old = legacy.slides.find(slide => slide.source.kind === "original" && slide.source.part === source.part)?.elements.find(element => element.kind === "text" && element.source.kind === "original" && element.source.objectId === source.objectId)
      if (old?.kind !== "text" || !preserveLegacySourceV2(original, old, element.body)) throw new UnsupportedTextFormat("legacy projection")
    } else if (previous?.kind === "text" && !isDeepStrictEqual(bodyFormatting(previous.body), bodyFormatting(element.body))) patchNativeSourceText(original, original, source.part, source.objectId, element.id, previous.body, element.body)
  }
}
