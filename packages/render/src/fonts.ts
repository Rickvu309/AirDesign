import type { Element, Slide } from "../../deck/src/model.ts"
import { flatten } from "../../deck/src/apply.ts"
export type FontReport = { loaded: string; missing: string[] }
export function fontReport(slide: Slide): FontReport {
  const requested = flatten(slide.elements).flatMap(e => e.kind === "text" ? e.runs.map(r => r.font) : [])
  return { loaded: "Geist", missing: [...new Set(requested.filter(font => font !== "Geist"))] }
}
export function elementFonts(element: Element): string[] { return element.kind === "text" ? element.runs.map(r => r.font) : [] }
export async function waitForFonts(document: Document): Promise<void> {
  const loaded = await Promise.all([document.fonts.load('400 16px Geist'), document.fonts.load('600 16px Geist')])
  if (loaded.some(faces => faces.length === 0)) throw new Error("Pinned Geist font faces are unavailable")
  await document.fonts.ready
  if (!document.fonts.check('400 16px Geist') || !document.fonts.check('600 16px Geist')) throw new Error("Pinned Geist fonts failed to load")
}
