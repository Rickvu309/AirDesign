declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { elementId, orderKeyBetween, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { applyRoute, freeShapeId, orderedParts, readParts, readShapes } from "./index.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const id = slideId("256")
const part = "ppt/slides/slide1.xml"
const box = { x: 0, y: 0, cx: 1000000, cy: 500000 }

async function clean() {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`))
}

it("writes an added text box under its own id and drops a removed shape, changing only that slide's part", async () => {
  const original = await clean()
  expect(freeShapeId(original, part)).toBe(3)
  const element = { node: elementId("256.9"), kind: "shape" as const, value: "", box, grouped: false }
  const changed = orderedParts(original, {
    file: [id],
    order: [
      { slide: "element-add", id, element },
      { slide: "element-remove", id, node: elementId("256.2") },
    ],
  })
  expect(readShapes(changed).map((shape) => [shape.shape, shape.box])).toEqual([["9", expect.objectContaining(box)]])
  for (const [name, bytes] of original) {
    if (name === part) expect(changed.get(name)).not.toEqual(bytes)
    else expect(changed.get(name)).toEqual(bytes)
  }
})

it("adds a text box to a slide added in the same session and refuses an id the slide already holds", async () => {
  const original = await clean()
  const added = slideId("257")
  const key = orderKeyBetween(orderKeyBetween(null, null), null)
  const slide = { slide: "add" as const, id: added, after: id, key, layout: id }
  const element = { node: elementId("257.9"), kind: "shape" as const, value: "", box, grouped: false }
  const changed = orderedParts(original, { file: [id], order: [slide, { slide: "element-add", id: added, element }] })
  expect(
    readShapes(changed)
      .filter((shape) => shape.slide === "257")
      .map((shape) => shape.shape),
  ).toContain("9")
  const taken = { ...element, node: elementId("256.2") }
  expect(() => orderedParts(original, { file: [id], order: [{ slide: "element-add", id, element: taken }] })).toThrow(
    "shape id",
  )
})

it("writes the same slide parts the validator judges in the element-added and element-removed cases", async () => {
  const original = await clean()
  const fixture = async (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
  const node = elementId("256.3")
  const element = {
    node,
    kind: "shape" as const,
    value: "",
    box: { x: 3657600, y: 3017520, cx: 4876800, cy: 822960 },
    grouped: false,
  }
  const added = orderedParts(original, { file: [id], order: [{ slide: "element-add", id, element }] })
  const typed = applyRoute(added, {
    name: "text",
    part,
    shape: "3",
    value: [{ from: 0, runs: [{ from: 0, text: "Added text" }] }],
  })
  expect(typed.get(part)).toEqual((await fixture("element-added.pptx")).get(part))
  const removed = orderedParts(original, {
    file: [id],
    order: [{ slide: "element-remove", id, node: elementId("256.2") }],
  })
  expect(removed.get(part)).toEqual((await fixture("element-removed.pptx")).get(part))
})
