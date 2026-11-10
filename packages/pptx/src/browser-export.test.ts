import { describe, expect, it } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { markupDocument, spliceBytes, type ByteEdit } from "./element-span.js"
import { readParts } from "./package-container.js"
import { applyRoute, shapeById } from "./slide-route.js"
import { browserExportFailures } from "./browser-export.js"

const slidePart = "ppt/slides/slide1.xml"
const shape = "2"
const text = "Hello!"
const fixture = `${process.cwd()}/scripts/pptx-fixtures/clean.pptx`

function flipByte(parts: ReadonlyMap<string, Uint8Array>, name: string): Map<string, Uint8Array> {
  const bytes = parts.get(name)
  if (bytes === undefined || bytes.length === 0) throw new Error(name)
  const changed = new Uint8Array(bytes)
  const byte = changed[0]
  if (byte === undefined) throw new Error(name)
  changed[0] = byte ^ 1
  const next = new Map(parts)
  next.set(name, changed)
  return next
}

function withoutRunProperties(parts: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const bytes = parts.get(slidePart)
  if (bytes === undefined) throw new Error(slidePart)
  const { elements } = markupDocument(bytes)
  const host = shapeById(elements, shape)
  const edits: ByteEdit[] = []
  for (const element of elements) {
    if (element.kind !== "a:rPr") continue
    let parent = element.parent
    let owned = false
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (ancestor.index === host.index) {
        owned = true
        break
      }
      parent = ancestor.parent
    }
    if (!owned) continue
    edits.push({ start: element.start, end: element.end, next: new Uint8Array() })
  }
  if (edits.length === 0) throw new Error("a:rPr")
  const next = new Map(parts)
  next.set(slidePart, spliceBytes(bytes, edits))
  return next
}

describe("browserExportFailures", () => {
  it("a correct Hello! export has no failures", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = applyRoute(clean, { name: "text", part: slidePart, shape, text })
    expect(browserExportFailures(clean, exported, shape, text)).toEqual([])
  })

  it("the same parts in another order", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = applyRoute(clean, { name: "text", part: slidePart, shape, text })
    const reversed = new Map([...exported].reverse())
    expect(browserExportFailures(clean, reversed, shape, text)).toEqual(["part order"])
    const names = [...exported.keys()]
    const swapped = new Map(exported)
    for (const name of names.slice(-2).reverse()) {
      const bytes = swapped.get(name)
      if (bytes === undefined) throw new Error(name)
      swapped.delete(name)
      swapped.set(name, bytes)
    }
    expect(browserExportFailures(clean, swapped, shape, text)).toEqual(["part order"])
  })

  it("a part that is gone and a part nobody asked for", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = new Map(applyRoute(clean, { name: "text", part: slidePart, shape, text }))
    exported.delete("docProps/app.xml")
    exported.set("ppt/media/extra.bin", new Uint8Array([1]))
    expect(browserExportFailures(clean, exported, shape, text)).toEqual([
      "missing part docProps/app.xml",
      "extra part ppt/media/extra.bin",
    ])
  })

  it("text bytes that only decode to Hello!", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = new Map(applyRoute(clean, { name: "text", part: slidePart, shape, text }))
    const bytes = exported.get(slidePart)
    if (bytes === undefined) throw new Error(slidePart)
    const document = markupDocument(bytes)
    const host = shapeById(document.elements, shape)
    const run = document.elements.find(
      (element) => element.kind === "a:t" && element.start > host.start && element.end < host.end,
    )
    if (run === undefined) throw new Error("a:t")
    const overlong = Uint8Array.of(0xc1, 0x88, 0x65, 0x6c, 0x6c, 0x6f, 0x21)
    exported.set(slidePart, spliceBytes(bytes, [{ start: run.openEnd, end: run.closeStart, next: overlong }]))
    expect(browserExportFailures(clean, exported, shape, text)).toContain("shape 2 text bytes")
  })

  it("V4 Goodbye is not Hello!", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = applyRoute(clean, { name: "text", part: slidePart, shape, text: "Goodbye" })
    expect(browserExportFailures(clean, exported, shape, text)).toEqual(["shape 2 text Goodbye"])
  })

  it("V8 one byte in [Content_Types].xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = flipByte(applyRoute(clean, { name: "text", part: slidePart, shape, text }), "[Content_Types].xml")
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("[Content_Types].xml"))).toBe(true)
  })

  it("V9 one byte in ppt/theme/theme1.xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = flipByte(applyRoute(clean, { name: "text", part: slidePart, shape, text }), "ppt/theme/theme1.xml")
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("ppt/theme/theme1.xml"))).toBe(true)
  })

  it("V14 edited run loses a:rPr", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = withoutRunProperties(applyRoute(clean, { name: "text", part: slidePart, shape, text }))
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("outside shape 2 text"))).toBe(true)
    expect(failures.some((failure) => failure.includes("Goodbye"))).toBe(false)
  })

  it("V16 Goodbye, content types, theme, run properties, and core.xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const goodbye = applyRoute(clean, { name: "text", part: slidePart, shape, text: "Goodbye" })
    const exported = flipByte(
      flipByte(flipByte(withoutRunProperties(goodbye), "[Content_Types].xml"), "ppt/theme/theme1.xml"),
      "docProps/core.xml",
    )
    const failures = browserExportFailures(clean, exported, shape, text)
    for (const name of [
      "Goodbye",
      "[Content_Types].xml",
      "ppt/theme/theme1.xml",
      "docProps/core.xml",
      "outside shape 2 text",
    ]) {
      expect(failures.some((failure) => failure.includes(name))).toBe(true)
    }
  })
})
