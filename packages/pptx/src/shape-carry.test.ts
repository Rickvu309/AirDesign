import {
  decide,
  elementId,
  openRegister,
  slideId,
  type ElementId,
  type IndexElement,
  type Media,
  type PastedLayers,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { carriedShape } from "./shape-carry.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const slide = slideId("256")
const part = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const box = { x: 500000, y: 600000, cx: 4572000, cy: 3048000 }

async function fixture(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function opened(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "pasted"), index: { ...index, total: index.elements.length, pages: [] } }
}

function pastedInto(parts: Parts, element: IndexElement, pasted: PastedLayers, bytes: ReadonlyMap<string, Uint8Array>) {
  const decision = decide(opened(parts), {
    command: "slide",
    file: [slide],
    edit: { slide: "element-add", id: slide, element, pasted },
  })
  if (decision.decision !== "apply") throw new Error(decision.code)
  const media = (sha256: string) => bytes.get(sha256)
  return exportParts(orderedParts(parts, decision.register, media), decision.register, media)
}

describe("a layer pasted from another deck", () => {
  it("carries a picture's markup with its image's bytes, and writes it into the other deck with its own link and part", async () => {
    const source = await fixture("picture-png.pptx")
    const carried = carriedShape(source, part, "4")
    if (carried === null) throw new Error("not carried")
    expect(carried.markup).toMatch(/^<p:pic xmlns:p="[^"]+" xmlns:a="[^"]+" xmlns:r="[^"]+">/)
    expect(carried.markup).toContain('r:embed="pasted0"')
    const [image] = carried.images
    if (image === undefined) throw new Error("no image")
    expect(image).toEqual({ bytes: source.get("ppt/media/picture-008753c5d40023df.png"), type: "image/png" })
    const media: Media = { sha256: "b".repeat(64), type: image.type }
    const target = await fixture("clean.pptx")
    const node = elementId("256.9")
    const element: IndexElement = { node, kind: "shape", value: null, box, grouped: false }
    const after = pastedInto(
      target,
      element,
      { markup: carried.markup, shape: "4", media: [media], layers: [] },
      new Map([[media.sha256, image.bytes]]),
    )
    const shapes = readShapes(after).filter((shape) => shape.part === part)
    expect(shapes.map((shape) => [shape.shape, shape.box])).toEqual([
      ["2", expect.anything()],
      ["9", expect.objectContaining(box)],
    ])
    const embed = /<p:cNvPr id="9"[\s\S]*?r:embed="(rId[0-9]+)"/.exec(decodeUtf8(after.get(part)!))?.[1]
    const target16 = `picture-${media.sha256.slice(0, 16)}.png`
    expect(decodeUtf8(after.get(rels)!)).toMatch(
      new RegExp(`Id="${embed ?? "none"}"[^>]*Target="../media/${target16}"`),
    )
    expect(after.get(`ppt/media/${target16}`)).toEqual(image.bytes)
    expect(newDuplicateShapeIds(shapeIdCounts(target), shapeIdCounts(after))).toEqual([])
    const changed = [part, rels, "[Content_Types].xml", `ppt/media/${target16}`]
    for (const [name, bytes] of target) if (!changed.includes(name)) expect(after.get(name), name).toEqual(bytes)
  })

  it("writes a pasted group with a new id on every layer inside it, at its new place", async () => {
    const source = await fixture("nested-groups.pptx")
    const carried = carriedShape(source, part, "2")
    if (carried === null) throw new Error("not carried")
    const target = await fixture("clean.pptx")
    const copy = (shape: number): ElementId => elementId(`256.${String(shape)}`)
    const group = (node: ElementId, parent: ElementId): IndexElement => ({
      node,
      kind: "group",
      value: null,
      box,
      grouped: true,
      group: parent,
    })
    const leaf = (node: ElementId, parent: ElementId): IndexElement => ({
      node,
      kind: "shape",
      value: "",
      box,
      grouped: true,
      group: parent,
    })
    const layers = [
      { shape: "3", element: group(copy(10), copy(9)) },
      { shape: "4", element: leaf(copy(11), copy(10)) },
      { shape: "5", element: leaf(copy(12), copy(10)) },
      { shape: "6", element: leaf(copy(13), copy(9)) },
    ]
    const element: IndexElement = { node: copy(9), kind: "group", value: null, box, grouped: false }
    const after = pastedInto(target, element, { markup: carried.markup, shape: "2", media: [], layers }, new Map())
    const ids = readShapes(after)
      .filter((shape) => shape.part === part)
      .map((shape) => shape.shape)
    expect(ids).toEqual(["2", "9", "10", "11", "12", "13"])
    expect(readShapes(after).find((shape) => shape.part === part && shape.shape === "9")?.box).toMatchObject({
      x: box.x,
      y: box.y,
    })
    expect(newDuplicateShapeIds(shapeIdCounts(target), shapeIdCounts(after))).toEqual([])
  })

  it("skips markup that does not parse instead of breaking the deck", async () => {
    const target = await fixture("clean.pptx")
    const element: IndexElement = { node: elementId("256.9"), kind: "shape", value: null, box, grouped: false }
    const after = pastedInto(
      target,
      element,
      { markup: "<p:sp><a:b></p:sp>", shape: "4", media: [], layers: [] },
      new Map(),
    )
    expect(after.get(part)).toEqual(target.get(part))
  })
})
