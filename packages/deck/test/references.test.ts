import { expect, expectTypeOf, it } from "vitest"
import { apply, parseDeck, parseChangeSet } from "../src/index.ts"
import { themeId, placeholderId, overlapId } from "../src/model.ts"
import type { ThemeId, PlaceholderId, OverlapId } from "../src/model.ts"
import { fixtureDeck } from "../src/fixture.ts"
it("rejects dangling theme, placeholder and overlap references atomically", () => {
  for (const field of ["theme", "placeholder", "overlap"]) {
    const deck = fixtureDeck(2)
    const slide = deck.slides[0]!
    const element = slide.elements[0]!
    const before = JSON.stringify(deck)
    const changes = parseChangeSet({ changes: [{ kind: "remove", target: slide.elements[1]!.id }, { kind: "set", target: element.id, value: { ...element, [field]: "missing" } }] })
    expect(apply(deck, changes)).toMatchObject({ ok: false, error: { code: "invalid-reference" } })
    expect(JSON.stringify(deck)).toBe(before)
  }
})
it("rejects replacement of an element with another kind without partial writes", () => {
  const deck = fixtureDeck(2)
  const slide = deck.slides[0]!
  const before = JSON.stringify(deck)
  const changes = parseChangeSet({ changes: [{ kind: "remove", target: slide.elements[1]!.id }, { kind: "set", target: slide.elements[0]!.id, value: { ...slide.elements[1], id: slide.elements[0]!.id } }] })
  expect(apply(deck, changes)).toMatchObject({ ok: false, error: { code: "invalid-structure" } })
  expect(JSON.stringify(deck)).toBe(before)
})
it("requires an empty style-bearing run instead of an uneditable empty array", () => {
  const deck = fixtureDeck(1)
  const value = JSON.parse(JSON.stringify(deck))
  value.slides[0].elements[0].runs = []
  expect(() => parseDeck(value)).toThrow()
  value.slides[0].elements[0].runs = [{ text: "", font: "Geist", size: 20, bold: false, color: "#000000" }]
  expect(parseDeck(value)).toEqual(value)
})

it("keeps reference namespaces distinct and rejects registry deletion atomically", () => {
  expectTypeOf<ThemeId>().not.toMatchTypeOf<PlaceholderId>()
  expectTypeOf<ThemeId>().not.toMatchTypeOf<OverlapId>()
  expectTypeOf<PlaceholderId>().not.toMatchTypeOf<OverlapId>()
  const deck = fixtureDeck(1)
  const slide = deck.slides[0]!
  const input = { ...deck, placeholders: [placeholderId("title")], overlaps: [overlapId("pair")], slides: [{ ...slide, elements: slide.elements.map(e => ({ ...e, placeholder: placeholderId("title"), overlap: overlapId("pair"), theme: themeId("default") })) }] }
  for (const field of ["themes", "placeholders", "overlaps"]) {
    const before = JSON.stringify(input)
    const changes = parseChangeSet({ changes: [{ kind: "set", target: input.id, value: { ...input, [field]: [] } }] })
    expect(apply(input, changes)).toMatchObject({ ok: false, error: { code: "invalid-reference" } })
    expect(JSON.stringify(input)).toBe(before)
  }
})
