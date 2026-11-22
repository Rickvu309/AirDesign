import type { doom } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { measureFaces } from "./doom-widths.js"

const face = { font: "Inter", bold: false, italic: false }

function fakeDocument(loaded: () => boolean = () => true) {
  const measured: string[] = []
  const context = {
    font: "",
    fontKerning: "",
    textRendering: "",
    measureText: (text: string) => {
      measured.push(text)
      return { width: 10 * text.length, fontBoundingBoxAscent: 20, fontBoundingBoxDescent: 5 }
    },
  }
  const doc = {
    createElement: () => ({ getContext: () => context }),
    documentElement: document.documentElement,
    fonts: { load: async () => [], check: () => loaded() },
  } as unknown as Document
  return { doc, measured }
}

const needs = (...texts: string[]): doom.FaceNeeds => ({ faces: [face], texts })

describe("measuring the faces a deck's text needs", () => {
  it("measures a character and a pair of characters once, however many times the deck asks again", async () => {
    const { doc, measured } = fakeDocument()
    const first = await measureFaces(doc, needs("ab"))
    const spent = measured.length
    expect(spent).toBeGreaterThan(0)
    expect(await measureFaces(doc, needs("ab"))).toBe(first)
    expect(await measureFaces(doc, needs("ba", "a"))).not.toBe(first)
    const added = measured.slice(spent)
    expect(added).toEqual(["ba"])
  })

  it("measures only what a typed letter adds and keeps what it measured before", async () => {
    const { doc, measured } = fakeDocument()
    const first = await measureFaces(doc, needs("ab"))
    const spent = measured.length
    const next = await measureFaces(doc, needs("abz"))
    const key = Object.keys(first)[0]!
    expect(next[key]?.advances.a).toBe(first[key]?.advances.a)
    expect(next[key]?.advances.z).toBe(10 / 32)
    expect(measured.slice(spent).sort()).toEqual(["bz", "z"])
  })

  it("measures a face again once it has loaded, when it was not there the first time", async () => {
    let ready = false
    const { doc, measured } = fakeDocument(() => ready)
    expect(await measureFaces(doc, needs("ab"))).toEqual({})
    expect(measured).toEqual([])
    ready = true
    const widths = await measureFaces(doc, needs("ab"))
    expect(Object.keys(widths)).toHaveLength(1)
  })
})
