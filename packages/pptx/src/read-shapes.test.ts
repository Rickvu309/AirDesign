import { describe, expect, it, vi } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { markupDocument, type MarkupElement } from "./element-span.js"
import { readParts } from "./package-container.js"
import { readShapes, readSlides, type ShapeKind } from "./read-shapes.js"
import { shapeById, applyRoute } from "./slide-route.js"

const work = vi.hoisted(() => ({ counting: false, parses: 0, elements: 0, visits: 0 }))

vi.mock("./element-span.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("./element-span.js")>()
  return {
    ...real,
    markupDocument: (bytes: Uint8Array) => {
      const document = real.markupDocument(bytes)
      if (!work.counting) return document
      work.parses += 1
      work.elements += document.elements.length
      const elements = new Proxy(document.elements, {
        get(target, key, receiver) {
          if (typeof key === "string" && Number.isInteger(Number(key))) work.visits += 1
          return Reflect.get(target, key, receiver)
        },
      })
      return { ...document, elements }
    },
  }
})

const kinds = new Set<ShapeKind>(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const slidePart = /^ppt\/slides\/[^/]+\.xml$/
const fixture = (name: string) => `${process.cwd()}/scripts/pptx-fixtures/${name}`

const inFallback = (elements: readonly MarkupElement[], index: number): boolean => {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (ancestor.kind === "mc:Fallback") return true
    parent = ancestor.parent
  }
  return false
}

describe("readSlides", () => {
  it("lists the slides in the presentation's order, not the order of the parts", () => {
    const xml = (text: string) => new TextEncoder().encode(text)
    const presentation = `<p:presentation><p:sldIdLst><p:sldId id="452" r:id="rId3"/><p:sldId id="382" r:id="rId2"/></p:sldIdLst></p:presentation>`
    const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
    const parts = new Map([
      ["ppt/slides/slide1.xml", xml("<p:sld/>")],
      ["ppt/slides/slide2.xml", xml("<p:sld/>")],
      ["ppt/presentation.xml", xml(presentation)],
      ["ppt/_rels/presentation.xml.rels", xml(rels)],
    ])
    expect(readSlides(parts)).toEqual([
      { slide: "452", part: "ppt/slides/slide2.xml" },
      { slide: "382", part: "ppt/slides/slide1.xml" },
    ])
  })
})

describe("readShapes", () => {
  it("reads the text and id that a text edit writes on clean.pptx", async () => {
    const parts = await readParts(readFileSync(fixture("clean.pptx")))
    const before = readShapes(parts)
    expect(before).toEqual([
      {
        slide: "256",
        part: "ppt/slides/slide1.xml",
        shape: "2",
        kind: "p:sp",
        box: { x: 457200, y: 457200, cx: 5486400, cy: 1828800 },
        text: [{ from: 0, runs: [{ from: 0, text: "Hello" }] }],
        locked: false,
      },
    ])
    const next = [{ from: 0, runs: [{ from: 0, text: "Next" }] }]
    const edited = applyRoute(parts, { name: "text", part: "ppt/slides/slide1.xml", shape: "2", value: next })
    expect(readShapes(edited)).toEqual([{ ...before[0], text: next }])
  })

  it("keeps each grouped and placeholder shape once", async () => {
    const parts = await readParts(readFileSync(fixture("census-updating-spm.pptx")))
    const shapes = readShapes(parts)
    expect(shapes.some((shape) => shape.kind === "p:grpSp")).toBe(true)
    expect(shapes.some((shape) => shape.text.length === 0)).toBe(true)
    expect(shapes.filter((shape) => shape.locked)).toHaveLength(1)
    let hosts = 0
    for (const [name, bytes] of parts) {
      if (!slidePart.test(name)) continue
      const { elements } = markupDocument(bytes)
      for (const element of elements) {
        if (!kinds.has(element.kind as ShapeKind) || inFallback(elements, element.index)) continue
        hosts += 1
      }
    }
    expect(shapes.length).toBe(hosts)
    const seen = new Set(shapes.map((shape) => `${shape.slide}.${shape.shape}`))
    expect(seen.size).toBe(shapes.length)
  })

  it("names each shape by its slide id on the real decks", async () => {
    for (const name of ["nasa-1d-cnn.pptx", "doe-heat-pumps.pptx"]) {
      const parts = await readParts(readFileSync(fixture(name)))
      const shapes = readShapes(parts)
      const seen = new Set<string>()
      const duplicates: string[] = []
      const mismatches: string[] = []
      const documents = new Map<string, ReturnType<typeof markupDocument>>()
      for (const row of shapes) {
        const id = `${row.slide}.${row.shape}`
        if (seen.has(id)) duplicates.push(id)
        seen.add(id)
        let document = documents.get(row.part)
        if (document === undefined) {
          const bytes = parts.get(row.part)
          if (bytes === undefined) throw new Error("part")
          document = markupDocument(bytes)
          documents.set(row.part, document)
        }
        const found = shapeById(document.elements, row.shape)
        if (found.kind !== row.kind) mismatches.push(`${id} is ${found.kind}, read as ${row.kind}`)
        if (inFallback(document.elements, found.index)) mismatches.push(`${id} sits in a fallback`)
      }
      expect(duplicates).toEqual([])
      expect(mismatches).toEqual([])
      expect(shapes.filter((shape) => shape.locked)).toHaveLength(name === "doe-heat-pumps.pptx" ? 5 : 0)
    }
  }, 30_000)

  it("parses each part once and visits each element a few times on a real deck", async () => {
    const parts = await readParts(readFileSync(fixture("doe-heat-pumps.pptx")))
    const slides = [...parts.keys()].filter((name) => slidePart.test(name)).length
    work.counting = true
    try {
      expect(readShapes(parts)).toHaveLength(247)
    } finally {
      work.counting = false
    }
    expect(work.parses).toBeLessThanOrEqual(slides + 2)
    expect(work.visits).toBeLessThanOrEqual(8 * work.elements)
  })
})
