declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import {
  elementId,
  nextSlideId,
  orderKeyAfter,
  presentSlides,
  slideId,
  type Geometry,
  type IndexElement,
  type SlideCommand,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { freeShapeId, indexPackage, orderedParts, paintReader, readParts, readShapes } from "./index.js"
import { applyStructuralRoute } from "./structural-route.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const id = slideId("256")
const part = "ppt/slides/slide1.xml"
const shapeBox = { x: 914400, y: 1371600, cx: 2743200, cy: 1828800 }
const lineBox = { x: 4572000, y: 4572000, cx: 3657600, cy: 0 }

function fixture(name: string) {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
}

function added(shape: number, geometry: Geometry): SlideCommand {
  const line = geometry === "line"
  const element: IndexElement = {
    node: elementId(`256.${String(shape)}`),
    kind: line ? "connector" : "shape",
    value: null,
    box: line ? lineBox : { ...shapeBox, x: shapeBox.x + (shape - 4) * 3200400 },
    grouped: false,
  }
  return { slide: "element-add", id, element, geometry }
}

async function shapesAdded() {
  const original = await fixture("blank.pptx")
  const first = freeShapeId(original, part)
  const order = [added(first, "rect"), added(first + 1, "ellipse"), added(first + 2, "line")]
  return { original, first, written: orderedParts(original, { file: [id], order }) }
}

it("adds a rectangle, an ellipse and a line in the theme's own style, changing only that slide's part", async () => {
  const { original, first, written } = await shapesAdded()
  for (const [name, bytes] of original) {
    if (name === part) expect(written.get(name)).not.toEqual(bytes)
    else expect(written.get(name)).toBe(bytes)
  }
  expect([...written.keys()].sort()).toEqual([...original.keys()].sort())
  const shapes = readShapes(written).filter((each) => Number(each.shape) >= first)
  expect(shapes.map((each) => [each.shape, each.kind, each.box])).toEqual([
    [String(first), "p:sp", shapeBox],
    [String(first + 1), "p:sp", { ...shapeBox, x: shapeBox.x + 3200400 }],
    [String(first + 2), "p:cxnSp", lineBox],
  ])
  const painted = paintReader(written)
    .slide(part)
    .elements.filter((each) => Number(each.shape) >= first)
  expect(painted.map((each) => each.geometry)).toEqual(["rect", "ellipse", "line"])
  const [rect, ellipse, line] = painted
  expect(rect?.fill).toMatchObject({ type: "solid" })
  expect(rect?.line?.fill).toMatchObject({ type: "solid" })
  expect(ellipse?.fill).toEqual(rect?.fill)
  expect(line?.fill).toEqual({ type: "none" })
  expect(line?.line?.fill).toEqual(rect?.fill)
  expect(painted.every((each) => each.text === null || each.text.paragraphs.length === 0)).toBe(true)
})

it("indexes each added shape back as the kind and empty value its slide command said", async () => {
  const { first, written } = await shapesAdded()
  const indexed = indexPackage(written).elements.filter((each) => Number(each.node.split(".")[1]) >= first)
  expect(indexed.map((each) => [each.kind, each.value])).toEqual([
    ["shape", null],
    ["shape", null],
    ["connector", null],
  ])
})

it("writes the same slide part the validator judges in the shapes-added case", async () => {
  const { written } = await shapesAdded()
  expect(written.get(part)).toEqual((await fixture("shapes-added.pptx")).get(part))
})

it("copies an added ellipse onto a copy of its slide with its geometry", async () => {
  const original = await fixture("blank.pptx")
  const first = freeShapeId(original, part)
  const file = [id]
  const add = added(first, "ellipse")
  const key = orderKeyAfter(presentSlides({ file, order: [add] }), id)
  if (key === null) throw new Error("key")
  const clone: SlideCommand = { slide: "clone", id: nextSlideId(file), source: id, key }
  const written = orderedParts(original, { file, order: [add, clone] })
  const ellipses = readShapes(written).filter((each) => each.shape === String(first))
  expect(ellipses.map((each) => each.kind)).toEqual(["p:sp", "p:sp"])
  for (const each of ellipses) {
    const painted = paintReader(written)
      .slide(each.part)
      .elements.find((element) => element.shape === String(first))
    expect(painted?.geometry).toBe("ellipse")
  }
})

it("refuses a drawn shape that brings text, since a drawn shape has none in this edit", async () => {
  const original = await fixture("blank.pptx")
  const route = { name: "spTree.add", part, text: "Words", geometry: "rect", ...shapeBox } as const
  expect(() => applyStructuralRoute(original, route)).toThrow("text")
})
