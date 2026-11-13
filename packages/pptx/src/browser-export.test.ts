import { describe, expect, it } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import type { TextValue } from "@airdesign/document"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { applyRoute, oneRunValue } from "./slide-route.js"
import { shapeById } from "./shape-tree.js"
import {
  browserExportFailures,
  paragraphExportFailures,
  routeExportFailures,
  type ParagraphExpectation,
} from "./browser-export.js"

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
    const referenced = encodeUtf8("&#72;ello!")
    exported.set(slidePart, spliceBytes(bytes, [{ start: run.openEnd, end: run.closeStart, next: referenced }]))
    expect(browserExportFailures(clean, exported, shape, text)).toContain("shape 2 text bytes")
    const overlong = Uint8Array.of(0xc1, 0x88, 0x65, 0x6c, 0x6c, 0x6f, 0x21)
    exported.set(slidePart, spliceBytes(bytes, [{ start: run.openEnd, end: run.closeStart, next: overlong }]))
    expect(browserExportFailures(clean, exported, shape, text)).toEqual([
      "shape 2",
      "ppt/slides/slide1.xml outside shape 2 text",
    ])
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
const supplies = "supplies"
const lines = ["Vapor Compression Cycle", "Pumped refrigerant"]

function doeValue(word = supplies): TextValue {
  return [
    { from: 0, runs: [{ from: 0, text: lines[0] ?? "" }] },
    { from: 1, runs: [{ from: 0, text: lines[1] ?? "" }] },
    {
      from: 2,
      runs: [
        { from: 0, text: "Pressurized (liquid) " },
        { from: 1, text: word },
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
  ]
}

const expectation: ParagraphExpectation = { part: doeSlide, shape: "45", value: doeValue() }

function doeExport(original: ReadonlyMap<string, Uint8Array>, value = doeValue()): Map<string, Uint8Array> {
  return applyRoute(original, { name: "text", part: doeSlide, shape: "45", value })
}

function slideBody(parts: ReadonlyMap<string, Uint8Array>) {
  const bytes = parts.get(doeSlide)
  if (bytes === undefined) throw new Error(doeSlide)
  const { elements } = markupDocument(bytes)
  const host = shapeById(elements, "45")
  const body = elements.find((element) => element.kind === "p:txBody" && element.parent === host.index)
  if (body === undefined) throw new Error("p:txBody")
  const paragraphs = elements.filter((element) => element.kind === "a:p" && element.parent === body.index)
  const child = (parent: MarkupElement | undefined, kind: string, nth = 0): MarkupElement => {
    const found = elements.filter((element) => element.kind === kind && element.parent === parent?.index)[nth]
    if (found === undefined) throw new Error(kind)
    return found
  }
  return { bytes, elements, host, body, paragraphs, child }
}

function withSlide(parts: ReadonlyMap<string, Uint8Array>, bytes: Uint8Array): Map<string, Uint8Array> {
  const next = new Map(parts)
  next.set(doeSlide, bytes)
  return next
}

function replaced(bytes: Uint8Array, from: number, to: number, next: string): Uint8Array {
  return spliceBytes(bytes, [{ start: from, end: to, next: encodeUtf8(next) }])
}

type Plant = (body: ReturnType<typeof slideBody>) => ByteEdit[]

function planted(parts: ReadonlyMap<string, Uint8Array>, plant: Plant): Map<string, Uint8Array> {
  const body = slideBody(parts)
  return withSlide(parts, spliceBytes(body.bytes, plant(body)))
}

function insertion(at: number, text: string): ByteEdit {
  return { start: at, end: at, next: encodeUtf8(text) }
}

describe("paragraphExportFailures", () => {
  it("a correct replaced run and new paragraph export has no failures", async () => {
    const original = await readParts(readFileSync(doeFixture))
    expect(paragraphExportFailures(original, doeExport(original), expectation)).toEqual([])
  })

  it("wrong text in a replaced run", async () => {
    const original = await readParts(readFileSync(doeFixture))
    const failures = paragraphExportFailures(original, doeExport(original, doeValue("delivers")), expectation)
    expect(failures.some((failure) => failure.startsWith("shape 45 paragraphs "))).toBe(true)
    expect(failures).toContain(`${doeSlide} bytes`)
  })

  const plants: readonly (readonly [string, Plant])[] = [
    [
      "a lost bold on a replaced run",
      ({ elements, paragraphs, child }) => {
        const run = child(paragraphs[3], "a:r", 1)
        const format = elements.find((element) => element.kind === "a:rPr" && element.parent === run.index)
        if (format === undefined) throw new Error("a:rPr")
        return [{ start: format.start, end: format.end, next: encodeUtf8("<a:rPr/>") }]
      },
    ],
    ["a changed byte in paragraph 0", ({ paragraphs }) => [insertion((paragraphs[0]?.start ?? 0) + 4, " ")]],
    ["a changed byte in paragraph 1", ({ paragraphs }) => [insertion((paragraphs[1]?.start ?? 0) + 4, " ")]],
    ["a changed a:bodyPr", ({ body, child }) => [insertion(child(body, "a:bodyPr").start + 9, ' rot="60000"')]],
    [
      "a changed a:lstStyle",
      ({ body, child }) => {
        const list = child(body, "a:lstStyle")
        return [{ start: list.start, end: list.end, next: encodeUtf8("<a:lstStyle><a:lvl1pPr/></a:lstStyle>") }]
      },
    ],
    [
      "a changed a:pPr in paragraph 2",
      ({ paragraphs, child }) => [insertion(child(paragraphs[2], "a:pPr").start + 6, ' rtl="1"')],
    ],
    [
      "a changed a:pPr in paragraph 3",
      ({ paragraphs, child }) => [insertion(child(paragraphs[3], "a:pPr").start + 6, ' rtl="1"')],
    ],
    [
      "a changed a:rPr of an unreplaced run",
      ({ paragraphs, child }) => [
        insertion(child(child(paragraphs[2], "a:r", 0), "a:rPr").start + 6, ' strike="sngStrike"'),
      ],
    ],
    [
      "a changed a:rPr of the replaced run",
      ({ paragraphs, child }) => [insertion(child(child(paragraphs[2], "a:r", 1), "a:rPr").start + 6, ' i="1"')],
    ],
    [
      "a bold new paragraph",
      ({ paragraphs, child }) => [insertion(child(paragraphs[4], "a:r").start + 5, '<a:rPr b="1"/>')],
    ],
    [
      "a new paragraph that lost its a:pPr",
      ({ paragraphs, child }) => {
        const format = child(paragraphs[4], "a:pPr")
        return [{ start: format.start, end: format.end, next: new Uint8Array() }]
      },
    ],
    [
      "a run split in two with the same text",
      ({ bytes, paragraphs, child }) => {
        const run = child(paragraphs[3], "a:r", 0)
        const source = decodeUtf8(bytes.subarray(run.start, run.end))
        const head = source.replace("Depressurized (gas) ", "Depressurized ")
        const tail = source.replace("Depressurized (gas) ", "(gas) ")
        expect(head).not.toBe(source)
        return [{ start: run.start, end: run.end, next: encodeUtf8(head + tail) }]
      },
    ],
  ]

  for (const [name, plant] of plants) {
    it(name, async () => {
      const original = await readParts(readFileSync(doeFixture))
      const failures = paragraphExportFailures(original, planted(doeExport(original), plant), expectation)
      expect(failures).toContain(`${doeSlide} bytes`)
      expect(
        failures
          .filter((failure) => failure !== `${doeSlide} bytes`)
          .every((failure) => failure.startsWith("shape 45 paragraphs ")),
      ).toBe(true)
    })
  }

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
    expect(paragraphExportFailures(original, withSlide(exported, changed), expectation)).toEqual([`${doeSlide} bytes`])
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
    const exported = doeExport(original, [...doeValue(), { from: 3, runs: [{ from: -1, text: "One more" }] }])
    const failures = paragraphExportFailures(original, exported, expectation)
    expect(failures.some((failure) => failure.startsWith("shape 45 paragraphs "))).toBe(true)
    expect(failures).toContain(`${doeSlide} bytes`)
  })
})

describe("routeExportFailures", () => {
  const routes = [
    { name: "move", part: slidePart, shape, x: 914400, y: 1371600 },
    { name: "resize", part: slidePart, shape, cx: 3657600, cy: 2743200 },
  ] as const

  it("passes the export the routes write and names each part that differs from it", async () => {
    const clean = await readParts(readFileSync(fixture))
    const exported = routes.reduce<ReadonlyMap<string, Uint8Array>>((parts, route) => applyRoute(parts, route), clean)
    expect(routeExportFailures(clean, exported, routes)).toEqual([])
    expect(routeExportFailures(clean, applyRoute(clean, routes[0]), routes)).toEqual([`${slidePart} bytes`])
    expect(routeExportFailures(clean, flipByte(exported, "docProps/app.xml"), routes)).toEqual([
      "part docProps/app.xml",
    ])
    expect(routeExportFailures(clean, clean, routes)).toEqual([`${slidePart} bytes`])
  })
})
