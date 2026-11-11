import { describe, expect, it } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { markupDocument, spliceBytes, type ByteEdit } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { applyRoute, oneRunValue, shapeById } from "./slide-route.js"
import { browserExportFailures, paragraphExportFailures, type ParagraphExpectation } from "./browser-export.js"

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
    const exported = applyRoute(clean, {
      name: "text",
      part: slidePart,
      shape,
      value: oneRunValue(clean, slidePart, shape, text),
    })
    expect(browserExportFailures(clean, exported, shape, text)).toEqual([])
  })

  it("the same parts in another order", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = applyRoute(clean, {
      name: "text",
      part: slidePart,
      shape,
      value: oneRunValue(clean, slidePart, shape, text),
    })
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
    const exported = new Map(
      applyRoute(clean, { name: "text", part: slidePart, shape, value: oneRunValue(clean, slidePart, shape, text) }),
    )
    exported.delete("docProps/app.xml")
    exported.set("ppt/media/extra.bin", new Uint8Array([1]))
    expect(browserExportFailures(clean, exported, shape, text)).toEqual([
      "missing part docProps/app.xml",
      "extra part ppt/media/extra.bin",
    ])
  })

  it("text bytes that only decode to Hello!", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = new Map(
      applyRoute(clean, { name: "text", part: slidePart, shape, value: oneRunValue(clean, slidePart, shape, text) }),
    )
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
    const exported = applyRoute(clean, {
      name: "text",
      part: slidePart,
      shape,
      value: oneRunValue(clean, slidePart, shape, "Goodbye"),
    })
    expect(browserExportFailures(clean, exported, shape, text)).toEqual(["shape 2 text Goodbye"])
  })

  it("V8 one byte in [Content_Types].xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = flipByte(
      applyRoute(clean, { name: "text", part: slidePart, shape, value: oneRunValue(clean, slidePart, shape, text) }),
      "[Content_Types].xml",
    )
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("[Content_Types].xml"))).toBe(true)
  })

  it("V9 one byte in ppt/theme/theme1.xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = flipByte(
      applyRoute(clean, { name: "text", part: slidePart, shape, value: oneRunValue(clean, slidePart, shape, text) }),
      "ppt/theme/theme1.xml",
    )
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("ppt/theme/theme1.xml"))).toBe(true)
  })

  it("V14 edited run loses a:rPr", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = withoutRunProperties(
      applyRoute(clean, { name: "text", part: slidePart, shape, value: oneRunValue(clean, slidePart, shape, text) }),
    )
    const failures = browserExportFailures(clean, exported, shape, text)
    expect(failures.some((failure) => failure.includes("outside shape 2 text"))).toBe(true)
    expect(failures.some((failure) => failure.includes("Goodbye"))).toBe(false)
  })

  it("V16 Goodbye, content types, theme, run properties, and core.xml", async () => {
    const clean = await readParts(readFileSync(fixture))
    const goodbye = applyRoute(clean, {
      name: "text",
      part: slidePart,
      shape,
      value: oneRunValue(clean, slidePart, shape, "Goodbye"),
    })
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

const doeSlide = "ppt/slides/slide7.xml"
const doeFixture = `${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`
const expectation: ParagraphExpectation = {
  part: doeSlide,
  shape: "45",
  paragraphs: [
    ["Vapor Compression Cycle"],
    ["Pumped refrigerant"],
    ["Pressurized (liquid) ", "supplies", " heat "],
    ["Depressurized (gas) ", "collects", " heat "],
    ["Extra line"],
  ],
  kept: 2,
  bold: ["supplies", "collects"],
}

function doeExport(original: ReadonlyMap<string, Uint8Array>, supplies = "supplies"): Map<string, Uint8Array> {
  return applyRoute(original, {
    name: "text",
    part: doeSlide,
    shape: "45",
    value: [
      { from: 0, runs: [{ from: 0, text: "Vapor Compression Cycle" }] },
      { from: 1, runs: [{ from: 0, text: "Pumped refrigerant" }] },
      {
        from: 2,
        runs: [
          { from: 0, text: "Pressurized (liquid) " },
          { from: 1, text: supplies },
          { from: 2, text: " heat " },
        ],
      },
      {
        from: 3,
        runs: [
          { from: 0, text: "Depressurized (gas) " },
          { from: 1, text: "collects" },
          { from: 2, text: " heat " },
        ],
      },
      { from: 3, runs: [{ from: -1, text: "Extra line" }] },
    ],
  })
}

function slideBody(parts: ReadonlyMap<string, Uint8Array>) {
  const bytes = parts.get(doeSlide)
  if (bytes === undefined) throw new Error(doeSlide)
  const { elements } = markupDocument(bytes)
  const host = shapeById(elements, "45")
  const body = elements.find((element) => element.kind === "p:txBody" && element.parent === host.index)
  if (body === undefined) throw new Error("p:txBody")
  const paragraphs = elements.filter((element) => element.kind === "a:p" && element.parent === body.index)
  return { bytes, elements, host, body, paragraphs }
}

function withSlide(parts: ReadonlyMap<string, Uint8Array>, bytes: Uint8Array): Map<string, Uint8Array> {
  const next = new Map(parts)
  next.set(doeSlide, bytes)
  return next
}

function replaced(bytes: Uint8Array, from: number, to: number, next: string): Uint8Array {
  return spliceBytes(bytes, [{ start: from, end: to, next: encodeUtf8(next) }])
}

describe("paragraphExportFailures", () => {
  it("a correct replaced run and new paragraph export has no failures", async () => {
    const original = await readParts(readFileSync(doeFixture))
    expect(paragraphExportFailures(original, doeExport(original), expectation)).toEqual([])
  })

  it("wrong text in a replaced run", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const failures = paragraphExportFailures(original, doeExport(original, "delivers"), expectation)
    expect(failures.some((failure) => failure.startsWith("shape 45 paragraphs "))).toBe(true)
    expect(failures).toContain("shape 45 bold supplies")
  })

  it("a lost bold on a replaced run", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = doeExport(original)
    const { bytes, elements, paragraphs } = slideBody(exported)
    const paragraph = paragraphs[3]
    if (paragraph === undefined) throw new Error("a:p")
    const format = elements.find(
      (element) =>
        element.kind === "a:rPr" &&
        element.start > paragraph.start &&
        element.end < paragraph.end &&
        element.attributes.some((item) => item.name === "b" && item.value === "1"),
    )
    if (format === undefined) throw new Error("a:rPr")
    const text = decodeUtf8(bytes.subarray(format.start, format.end))
    const unbolded = replaced(bytes, format.start, format.end, text.replace(' b="1"', ""))
    expect(paragraphExportFailures(original, withSlide(exported, unbolded), expectation)).toEqual([
      "shape 45 bold collects",
    ])
  })

  it("a changed byte in paragraph 0", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = doeExport(original)
    const { bytes, paragraphs } = slideBody(exported)
    const paragraph = paragraphs[0]
    if (paragraph === undefined) throw new Error("a:p")
    const source = decodeUtf8(bytes.subarray(paragraph.start, paragraph.end))
    const spaced = replaced(bytes, paragraph.start, paragraph.end, source.replace("<a:p>", "<a:p >"))
    const failures = paragraphExportFailures(original, withSlide(exported, spaced), expectation)
    expect(failures).toContain("shape 45 paragraph 0 bytes")
  })

  it("a changed byte in another part", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = flipByte(doeExport(original), "docProps/app.xml")
    expect(paragraphExportFailures(original, exported, expectation)).toEqual(["part docProps/app.xml"])
  })

  it("a changed byte in the slide outside the shape text", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = doeExport(original)
    const { bytes } = slideBody(exported)
    const declaration = decodeUtf8(bytes.subarray(0, 60))
    expect(declaration).toContain('version="1.0"')
    const changed = replaced(bytes, 0, 60, declaration.replace('version="1.0"', 'version="1.1"'))
    expect(paragraphExportFailures(original, withSlide(exported, changed), expectation)).toEqual([
      `${doeSlide} outside shape 45 text`,
    ])
  })

  it("a part added, removed or reordered", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = doeExport(original)
    const added = new Map(exported)
    added.set("ppt/media/extra.bin", new Uint8Array([1]))
    expect(paragraphExportFailures(original, added, expectation)).toEqual(["extra part ppt/media/extra.bin"])
    const removed = new Map(exported)
    removed.delete("docProps/app.xml")
    expect(paragraphExportFailures(original, removed, expectation)).toEqual(["missing part docProps/app.xml"])
    expect(paragraphExportFailures(original, new Map([...exported].reverse()), expectation)).toEqual(["part order"])
  })

  it("a sixth paragraph", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const exported = applyRoute(doeExport(original), {
      name: "text",
      part: doeSlide,
      shape: "45",
      value: [
        { from: 0, runs: [{ from: 0, text: "Vapor Compression Cycle" }] },
        { from: 1, runs: [{ from: 0, text: "Pumped refrigerant" }] },
        {
          from: 2,
          runs: [
            { from: 0, text: "Pressurized (liquid) " },
            { from: 1, text: "supplies" },
            { from: 2, text: " heat " },
          ],
        },
        {
          from: 3,
          runs: [
            { from: 0, text: "Depressurized (gas) " },
            { from: 1, text: "collects" },
            { from: 2, text: " heat " },
          ],
        },
        { from: 4, runs: [{ from: 0, text: "Extra line" }] },
        { from: 4, runs: [{ from: 0, text: "One more" }] },
      ],
    })
    const failures = paragraphExportFailures(original, exported, expectation)
    expect(failures.some((failure) => failure.startsWith("shape 45 paragraphs "))).toBe(true)
  })
})
