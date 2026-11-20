import {
  cloneOf,
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Command,
  type ElementId,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const slide = slideId("256")
const part = "ppt/slides/slide1.xml"
const rectangle = elementId("256.2")
const copy = elementId("256.9")
const moved = { x: 1000000, y: 2500000, cx: 5486400, cy: 1828800 }

async function clean(): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`)))
}

function opened(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "clean"), index: { ...index, total: index.elements.length, pages: [] } }
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

function edited(parts: Parts, node: ElementId): Register {
  return landed(opened(parts), [
    { command: "add", node, floor: "Hello", route: "clean" },
    { command: "person", node, value: "Hello again" },
    { command: "person", node, v: format, patch: { box: { rot: { set: 1800000 } } } },
  ])
}

function sliced(register: Register, edit: SlideCommand, file: readonly ReturnType<typeof slideId>[]): Register {
  return landed(register, [{ command: "slide", file, edit }])
}

function exported(parts: Parts, register: Register): Parts {
  return exportParts(orderedParts(parts, register), register)
}

function shapeXml(parts: Parts, id: string): string {
  const xml = decodeUtf8(parts.get(part)!)
  const start = xml.indexOf(`<p:sp><p:nvSpPr><p:cNvPr id="${id}"`)
  return xml.slice(start, xml.indexOf("</p:sp>", start) + "</p:sp>".length)
}

describe("element clone export", () => {
  it("writes the copy just above its source with its own id, the source's look and its own box", async () => {
    const parts = await clean()
    const file = [slide]
    const source = edited(parts, rectangle)
    const made = cloneOf(source, rectangle, copy, moved)
    if (!made.ok) throw new Error(made.refusal)
    const command = made.command
    const after = exported(parts, sliced(source, command, file))
    const shapes = readShapes(after).filter((shape) => shape.part === part)
    expect(shapes.map((shape) => shape.shape)).toEqual(["2", "9"])
    expect(shapes[1]?.text).toEqual([{ from: 0, runs: [{ from: 0, text: "Hello again" }] }])
    expect(shapes[1]?.box).toMatchObject(moved)
    expect(shapeXml(after, "9")).toContain('<a:xfrm rot="1800000">')
    expect(shapeXml(after, "2")).toBe(shapeXml(exported(parts, source), "2"))
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(after))).toEqual([])
    for (const [name, bytes] of parts) if (name !== part) expect(after.get(name), name).toEqual(bytes)
  })

  it("keeps a copy whose source is taken away later, and drops a copy that is taken away", async () => {
    const parts = await clean()
    const file = [slide]
    const made = cloneOf(opened(parts), rectangle, copy, moved)
    if (!made.ok) throw new Error(made.refusal)
    const command = made.command
    const cloned = sliced(opened(parts), command, file)
    const sourceGone = sliced(cloned, { slide: "element-remove", id: slide, node: rectangle }, file)
    expect(readShapes(exported(parts, sourceGone)).map((shape) => shape.shape)).toEqual(["9"])
    const copyGone = sliced(cloned, { slide: "element-remove", id: slide, node: copy }, file)
    expect(exported(parts, copyGone).get(part)).toEqual(parts.get(part))
  })

  it("copies a copy and a text box added in the same session even after the box is taken away", async () => {
    const parts = await clean()
    const file = [slide]
    const box = { x: 0, y: 0, cx: 1000000, cy: 500000 }
    const added = elementId("256.3")
    const withBox = sliced(
      opened(parts),
      { slide: "element-add", id: slide, element: { node: added, kind: "shape", value: "", box, grouped: false } },
      file,
    )
    const first = cloneOf(withBox, added, elementId("256.4"), moved)
    if (!first.ok) throw new Error(first.refusal)
    const once = sliced(withBox, first.command, file)
    const second = cloneOf(once, elementId("256.4"), elementId("256.5"), box)
    if (!second.ok) throw new Error(second.refusal)
    const twice = sliced(sliced(once, second.command, file), { slide: "element-remove", id: slide, node: added }, file)
    const shapes = readShapes(exported(parts, twice)).map((shape) => [shape.shape, shape.box])
    expect(shapes).toEqual([
      ["2", expect.anything()],
      ["4", expect.objectContaining(moved)],
      ["5", expect.objectContaining(box)],
    ])
  })
})
