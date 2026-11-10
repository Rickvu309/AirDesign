import { describe, expect, it } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { markupDocument, type MarkupElement } from "./element-span.js"
import { exportPackage, samePartBytes } from "./export-package.js"
import { readParts } from "./package-bytes.js"
import { readPackage } from "./package-limits.js"
import { readShapes, type ShapeKind } from "./read-shapes.js"
import { shapeById, applyRoute } from "./slide-route.js"

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
        text: "Hello",
        locked: false,
      },
    ])
    const edited = applyRoute(parts, { name: "text", part: "ppt/slides/slide1.xml", shape: "2", text: "Next" })
    expect(readShapes(edited)).toEqual([{ ...before[0], text: "Next" }])
  })

  it("keeps each grouped and placeholder shape once", async () => {
    const parts = await readParts(readFileSync(fixture("census-updating-spm.pptx")))
    const shapes = readShapes(parts)
    expect(shapes.some((shape) => shape.kind === "p:grpSp")).toBe(true)
    expect(shapes.some((shape) => shape.text === "")).toBe(true)
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
      const documents = new Map<string, ReturnType<typeof markupDocument>>()
      for (const row of shapes) {
        const id = `${row.slide}.${row.shape}`
        expect(seen.has(id)).toBe(false)
        seen.add(id)
        let document = documents.get(row.part)
        if (document === undefined) {
          const bytes = parts.get(row.part)
          if (bytes === undefined) throw new Error("part")
          document = markupDocument(bytes)
          documents.set(row.part, document)
        }
        const found = shapeById(document.elements, row.shape)
        expect(found.kind).toBe(row.kind)
        expect(inFallback(document.elements, found.index)).toBe(false)
      }
      expect(shapes.filter((shape) => shape.locked)).toHaveLength(name === "doe-heat-pumps.pptx" ? 5 : 0)
      const written = await exportPackage(readFileSync(fixture(name)), parts)
      const read = await readPackage(written)
      expect(read.ok).toBe(true)
      if (read.ok) expect(samePartBytes(parts, read.parts)).toBe(true)
    }
  }, 30_000)
})
