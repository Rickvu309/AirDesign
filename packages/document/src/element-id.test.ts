import fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
  elementId,
  legacyElement,
  readElementId,
  rootElement,
  shapeOf,
  slideId,
  slideNode,
  slideKind,
  storedElements,
} from "./element-id.js"

const accepted = [
  "258.7",
  "0.0",
  "0.0000000000",
  "n4k2j9x0q1zab.7",
  "258.n4k2j9x0q1zab",
  "n4k2j9x0q1zab.n4k2j9x0q1zab",
  "258.notes",
  "258.slide",
  "n4k2j9x0q1zab.slide",
]
const refused = [
  "",
  "a",
  "b",
  "258.",
  ".7",
  "258",
  "12345678901.7",
  "258.12345678901",
  "n4k2j9x0q1za.7",
  "N4K2J9X0Q1ZAB.7",
  "258.7\n",
  "258.slides",
  "258.notess",
  "slide.7",
  "toString",
  "constructor",
  "__proto__",
  "hasOwnProperty",
]

describe("readElementId", () => {
  it("returns the value for an id the pattern accepts", () => {
    for (const value of accepted) expect(readElementId(value)).toBe(value)
  })

  it("returns undefined for a malformed id", () => {
    for (const value of refused) expect(readElementId(value), value).toBeUndefined()
  })

  it("returns undefined for a value that is not a string", () => {
    for (const value of [undefined, null, 7, {}, [], ["258.7"], true]) expect(readElementId(value)).toBeUndefined()
  })

  it("never throws and agrees with elementId for any string", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const read = readElementId(value)
        if (read === undefined) {
          expect(() => elementId(value)).toThrow("element id")
          return
        }
        expect(elementId(value)).toBe(value)
        expect(read).toBe(value)
      }),
    )
  })

  it("accepts a generated id that has the shape of a slide and a shape", () => {
    const part = fc.oneof(fc.integer({ min: 0, max: 9999999999 }).map(String), fc.stringMatching(/^n[0-9a-z]{12}$/))
    fc.assert(
      fc.property(part, part, (slide, shape) => {
        expect(readElementId(`${slide}.${shape}`)).toBe(`${slide}.${shape}`)
      }),
    )
  })
})

describe("elementId", () => {
  it("returns the value for an id the pattern accepts", () => {
    for (const value of accepted) expect(elementId(value)).toBe(value)
  })

  it("throws element id for a malformed value", () => {
    for (const value of refused) expect(() => elementId(value), value).toThrow("element id")
  })

  it("keeps the shape of a minted id", () => {
    expect(shapeOf(elementId("258.n4k2j9x0q1zab"))).toEqual({ slide: "258", shape: "n4k2j9x0q1zab" })
  })
})

describe("the named elements", () => {
  it("name the root and the legacy element", () => {
    expect(rootElement).toBe("a")
    expect(legacyElement).toBe("b")
  })

  it("list every stored key of a register as an element id", () => {
    expect(storedElements({ elements: { [rootElement]: 1, [legacyElement]: 2, "258.7": 3 } })).toEqual([
      "a",
      "b",
      "258.7",
    ])
  })

  it("drops a stored key that is not an element id", () => {
    expect(storedElements({ elements: { toString: 1, "258.": 2, "258.7": 3 } })).toEqual(["258.7"])
  })
})

describe("slideKind", () => {
  it("names a slide's own nodes and nothing else", () => {
    expect(slideKind(elementId("258.notes"))).toBe("notes")
    expect(slideKind(elementId("258.slide"))).toBe("slide")
    expect(slideKind(elementId("258.7"))).toBeNull()
    expect(slideKind(elementId("258.n4k2j9x0q1zab"))).toBeNull()
  })

  it("builds the node it reads", () => {
    expect(slideNode(slideId("258"), "slide")).toBe(elementId("258.slide"))
    expect(slideKind(slideNode(slideId("258"), "notes"))).toBe("notes")
  })
})
