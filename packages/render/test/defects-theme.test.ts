import { expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { apply } from "../../deck/src/apply.ts"
import { fixtureDeck, fixtureElement } from "../../deck/src/fixture.ts"
import { id, overlapId, themeId } from "../../deck/src/model.ts"
import type { Element } from "../../deck/src/model.ts"
import { hardDefects } from "../../lint/src/hard-defects.ts"
import { thumbnailCache } from "../src/server.ts"
import { Slide } from "../src/slide.tsx"
it("rerenders referenced themes and invalidates only dependent slide thumbnails", async () => {
  const deck = fixtureDeck(2, 3)
  const first = deck.slides[0]!
  const second = deck.slides[1]!
  const third = deck.slides[2]!
  const input = { ...deck, slides: [first, { ...second, theme: null, elements: second.elements.map(e => ({ ...e, theme: themeId("default") })) }, { ...third, theme: null }] }
  const cache = thumbnailCache<number>()
  let count = 0
  const capture = async () => ++count
  for (const slide of input.slides) await cache(input.id, slide, capture)
  const result = apply(input, { changes: [{ kind: "set", target: input.id, value: { ...input, themes: [{ ...input.themes[0]!, background: "#123456", font: "Unavailable" }] } }] })
  if (!result.ok) throw new Error(result.error.message)
  const changed = result.deck
  expect(changed.slides[0]!.version).toBeGreaterThan(first.version)
  expect(changed.slides[1]!.version).toBeGreaterThan(second.version)
  expect(changed.slides[2]).toBe(input.slides[2])
  for (const slide of changed.slides) await cache(input.id, slide, capture)
  expect(count).toBe(5)
  const html = renderToStaticMarkup(createElement(Slide, { slide: changed.slides[0]!, themes: changed.themes }))
  expect(html).toContain("background:#123456")
  expect(html).toContain("Missing fonts: Unavailable")
  expect(html).toContain('data-theme-font="Unavailable"')
})
it("checks painted nested descendants across groups, ignoring empty group space and preview children", () => {
  const slide = fixtureDeck(0).slides[0]!
  const child = { ...fixtureElement(1), box: { x: 80, y: 0, width: 40, height: 40 } }
  const group: Element = { ...fixtureElement(2), kind: "group", box: { x: 100, y: 100, width: 50, height: 50 }, children: [child] }
  const outside = { ...fixtureElement(3), box: { x: 180, y: 100, width: 40, height: 40 } }
  expect(hardDefects({ ...slide, elements: [group, outside] })).toMatchObject([{ code: "accidental-overlap", ids: [child.id, outside.id], location: { x: 180, y: 100 } }])
  const small: Element = { ...group, children: [{ ...child, box: { x: 0, y: 0, width: 10, height: 10 } }] }
  expect(hardDefects({ ...slide, elements: [small, { ...outside, box: { x: 140, y: 140, width: 10, height: 10 } }] })).toEqual([])
  const nested: Element = { ...group, id: id("nested"), box: { ...group.box, x: 10, y: 20 }, children: [{ ...group, box: { ...group.box, x: 90, y: 80 } }] }
  expect(hardDefects({ ...slide, elements: [nested, outside] })[0]).toMatchObject({ ids: [child.id, outside.id], location: { x: 180, y: 100 } })
  expect(hardDefects({ ...slide, elements: [{ ...group, overlap: overlapId("intended") }, { ...outside, overlap: overlapId("intended") }] })).toEqual([])
  expect(hardDefects({ ...slide, elements: [{ ...group, support: { kind: "kept", preview: null } }, outside] })).toEqual([])
})
