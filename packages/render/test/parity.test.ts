import { expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Slide as DeckSlide } from "../../deck/src/model.ts"
import { overlapId } from "../../deck/src/model.ts"
import { fixtureDeck, fixtureElement } from "../../deck/src/fixture.ts"
import { Slide } from "../src/slide.tsx"
import { fontReport } from "../src/fonts.ts"
import { hardDefects } from "../../lint/src/hard-defects.ts"
import { thumbnailCache } from "../src/server.ts"
it("uses one geometry tree for client and snapshot with accessible SVG hit areas", () => {
  const slide = fixtureDeck(3).slides[0]!
  const markup = renderToStaticMarkup(createElement(Slide, { slide }))
  expect(markup).toContain('viewBox="0 0 100 100"')
  expect(markup).toContain('data-element="s0e1"')
  expect(markup).toContain('inline-size:960px')
})
it("discloses missing fonts and uses the pinned fallback", () => {
  const slide = fixtureDeck(1).slides[0]!
  const text = slide.elements[0]!
  if (text.kind !== "text") throw new Error("text fixture")
  const changed: DeckSlide = { ...slide, elements: [{ ...text, runs: [{ ...text.runs[0], font: "Unavailable" }] }] }
  expect(fontReport(changed)).toEqual({ loaded: "Geist", missing: ["Unavailable"] })
  expect(renderToStaticMarkup(createElement(Slide, { slide: changed }))).toContain("Missing fonts: Unavailable")
})
it("reports clipped ids and locations and distinguishes approved overlap", () => {
  const slide = fixtureDeck(0).slides[0]!
  const a = { ...fixtureElement(1), box: { x: -10, y: 3, width: 40, height: 40 } }
  const b = { ...fixtureElement(2), box: a.box }
  expect(hardDefects({ ...slide, elements: [a, b] })).toMatchObject([{ code: "clipping", ids: [a.id], location: { x: -10, y: 3 } }, { code: "clipping" }, { code: "accidental-overlap" }])
  const approved = { ...slide, elements: [{ ...a, overlap: overlapId("approved") }, { ...b, overlap: overlapId("approved") }] }
  expect(hardDefects(approved).some(d => d.code === "accidental-overlap")).toBe(false)
  expect(hardDefects({ ...slide, elements: [fixtureElement(4)] }, ["e4"])[0]?.code).toBe("clipping")
})
it("caches thumbnails by deck, slide and version and evicts failed captures", async () => {
  const deck = fixtureDeck(2)
  const slide = deck.slides[0]!
  const cached = thumbnailCache<number>()
  let renders = 0
  const capture = async () => ++renders
  expect(await cached(deck.id, slide, capture)).toBe(1)
  expect(await cached(deck.id, { ...slide }, capture)).toBe(1)
  expect(await cached(deck.id, { ...slide, version: 1 }, capture)).toBe(2)
  await expect(cached(deck.id, { ...slide, version: 2 }, async () => { throw new Error("capture failed") })).rejects.toThrow("capture failed")
  expect(await cached(deck.id, { ...slide, version: 2 }, capture)).toBe(3)
})
