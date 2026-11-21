import {
  decide,
  elementId,
  openRegister,
  slideId,
  writeTextValue,
  type Alpha,
  type Box,
  type Command,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { fadedFrames } from "./frame-fade.js"
import { indexPackage } from "./index-package.js"
import { markupBytesRead } from "./markup-reader.js"
import { readParts } from "./package-container.js"
import { readShapes } from "./read-shapes.js"
import { writtenDeck } from "./written-deck.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const blankBytes = new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`))

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision === "refuse") throw new Error(decision.code)
  return decision.register
}

function buildStyledLayers(
  parts: ReadonlyMap<string, Uint8Array>,
  shapeCount: number,
  options: { readonly fade?: boolean } = {},
): Register {
  const index = indexPackage(parts)
  const slide = slideId(index.slides[0]!.id)
  const file = index.slides.map((each) => slideId(each.id))
  let register: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  let nextShape = index.slides[0]!.free ?? 2
  const created: { readonly node: ReturnType<typeof elementId>; readonly box: Box }[] = []
  for (let i = 0; i < shapeCount; i += 1) {
    const node = elementId(`${slide}.${String(nextShape++)}`)
    const col = i % 8
    const row = Math.floor(i / 8)
    const box: Box = {
      x: (20 + col * 110) * 12_700,
      y: (20 + row * 48) * 12_700,
      cx: 100 * 12_700,
      cy: 40 * 12_700,
    }
    const element: IndexElement = { node, kind: "shape", value: "", box, grouped: false }
    register = landed(register, {
      command: "slide",
      file,
      edit: { slide: "element-add", id: slide, element },
    })
    register = landed(register, { command: "add", node, floor: "", route: "clean" })
    const value = writeTextValue([
      { from: 0, runs: [{ from: -1, text: `Heading ${String(i)}`, bold: true, size: 1400 }] },
      { from: 0, runs: [{ from: -1, text: `$1.${String(i)}M` }] },
      { from: 0, runs: [{ from: -1, text: "One point" }] },
    ])
    register = landed(register, {
      command: "person",
      node,
      v: 1,
      patch: {
        text: { value: { set: value } },
        fills: { p0: { set: { solid: { scheme: i % 2 === 0 ? "accent1" : "accent2" } } } },
        geometry: { shape: { set: { preset: "roundRect", adjust: {} } } },
        border: { width: { set: 12_700 } },
        body: { anchor: { set: "ctr" } },
      },
    })
    created.push({ node, box })
  }
  for (let start = 0; start + 4 <= created.length; start += 20) {
    const members = created.slice(start, start + 4)
    const frameNode = elementId(`${slide}.${String(nextShape++)}`)
    const backdropNode = elementId(`${slide}.${String(nextShape++)}`)
    const left = Math.min(...members.map((member) => member.box.x))
    const top = Math.min(...members.map((member) => member.box.y))
    const right = Math.max(...members.map((member) => member.box.x + member.box.cx))
    const bottom = Math.max(...members.map((member) => member.box.y + member.box.cy))
    const frameBox: Box = { x: left, y: top, cx: right - left, cy: bottom - top }
    register = landed(register, {
      command: "slide",
      file,
      edit: {
        slide: "element-group",
        id: slide,
        element: { node: frameNode, kind: "group", value: null, box: frameBox, grouped: false },
        backdrop: { node: backdropNode, kind: "shape", value: null, box: frameBox, grouped: false },
        members,
      },
    })
    if (options.fade) {
      register = landed(register, { command: "add", node: frameNode, floor: "", route: "clean" })
      register = landed(register, {
        command: "person",
        node: frameNode,
        v: 1,
        patch: { layout: { flow: { set: "horizontal" }, opacity: { set: 50_000 as Alpha } } },
      })
    }
  }
  return register
}

function fullExportBytes(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): {
  readonly parsed: number
  readonly exported: ReadonlyMap<string, Uint8Array>
} {
  const before = markupBytesRead()
  const written = writtenDeck(parts, register, () => undefined)
  const exported = fadedFrames(
    exportParts(written.parts, written.register, () => undefined),
    written.register,
  )
  return { parsed: markupBytesRead() - before, exported }
}

describe("export markup reads grow linearly with layers per slide", () => {
  it("does not grow per-layer markup reads when quadrupling layers in writtenDeck + exportParts + fadedFrames", async () => {
    const parts = await readParts(blankBytes)
    const small = fullExportBytes(parts, buildStyledLayers(parts, 20))
    const large = fullExportBytes(parts, buildStyledLayers(parts, 80))
    const smallPerLayer = small.parsed / 20
    const largePerLayer = large.parsed / 80
    expect(largePerLayer / smallPerLayer).toBeLessThan(1.4)
    expect(readShapes(large.exported).length).toBeGreaterThanOrEqual(80)
  })

  it("does not grow per-layer markup reads for faded frames as framed layers quadruple", async () => {
    const parts = await readParts(blankBytes)
    const smallRegister = buildStyledLayers(parts, 20, { fade: true })
    const largeRegister = buildStyledLayers(parts, 80, { fade: true })
    const smallWritten = writtenDeck(parts, smallRegister, () => undefined)
    const smallEdited = exportParts(smallWritten.parts, smallWritten.register, () => undefined)
    const largeWritten = writtenDeck(parts, largeRegister, () => undefined)
    const largeEdited = exportParts(largeWritten.parts, largeWritten.register, () => undefined)
    const beforeSmall = markupBytesRead()
    fadedFrames(smallEdited, smallWritten.register)
    const smallParsed = markupBytesRead() - beforeSmall
    const beforeLarge = markupBytesRead()
    fadedFrames(largeEdited, largeWritten.register)
    const largeParsed = markupBytesRead() - beforeLarge
    expect(largeParsed / 80 / (smallParsed / 20)).toBeLessThan(1.4)
  })
})
