import type { Deck, Element, Slide } from "../../deck/src/model.ts"
import {bodyStyles, textElements} from "../../deck/src/text/content.ts"
import type {NativeElement, NativeSlide} from "../../deck/src/text/native-v3.ts"
export type FontReport = { loaded: string; missing: string[] }
export function fontReport(slide: Slide | NativeSlide, themes: Deck["themes"] = []): FontReport {
  const requested = textElements(slide.elements).flatMap(e => e.kind === "text" ? elementFonts(e) : [])
  requested.push(...themes.filter(t => t.id === slide.theme || textElements(slide.elements).some(e => e.theme === t.id)).map(t => t.font))
  return { loaded: "Geist", missing: [...new Set(requested.filter(font => font !== "Geist"))] }
}
export function elementFonts(element: Element | NativeElement): string[] { return element.kind === "text" ? ("body" in element ? bodyStyles(element.body) : element.runs).map(style => style.font) : [] }
export async function waitForFonts(document: Document): Promise<void> {
  const loaded = await Promise.all([document.fonts.load('400 16px Geist'), document.fonts.load('600 16px Geist')])
  if (loaded.some(faces => faces.length === 0)) throw new Error("Pinned Geist font faces are unavailable")
  await document.fonts.ready
  if (!document.fonts.check('400 16px Geist') || !document.fonts.check('600 16px Geist')) throw new Error("Pinned Geist fonts failed to load")
}

export function fontFamily(font: string): string { return font === "Geist" ? "Geist" : `${JSON.stringify(font)}, Geist` }
