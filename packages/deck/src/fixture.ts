import { id, themeId } from "./model.ts"
import type { Deck, Element, Slide } from "./model.ts"
export function fixtureElement(index: number): Element {
  const base = { id: id(`e${index}`), box: { x: 28 + index % 20 * 44, y: 150 + Math.floor(index / 20) * 24, width: 38, height: 18 }, source: { kind: "created" }, support: { kind: "native" }, theme: null, placeholder: null, overlap: null } satisfies Partial<Element>
  if (index === 0) return { ...base, kind: "text", box: { x: 40, y: 40, width: 800, height: 60 }, runs: [{ text: "A clear direction", bold: true, font: "Geist", size: 40, color: "#172333" }] }
  return { ...base, kind: "shape", geometry: index % 3 === 0 ? "ellipse" : index % 3 === 1 ? "rectangle" : "triangle", fill: index % 2 === 0 ? "#3e6fbe" : "#b4ccea" }
}
export function fixtureDeck(elementCount = 300, slideCount = 1): Deck {
  const slides: Slide[] = Array.from({ length: slideCount }, (_, index) => ({ id: id(`s${index}`), version: 0, size: { width: 960, height: 540 }, elements: Array.from({ length: elementCount }, (_, n) => ({ ...fixtureElement(n), id: id(`s${index}e${n}`) })), notes: "Canonical render fixture", theme: themeId("default"), source: { kind: "created" } }))
  return { id: id("deck"), version: 0, slides, themes: [{ id: themeId("default"), font: "Geist", background: "#ffffff" }] }
}
