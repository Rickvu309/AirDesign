declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { elementId, slideId } from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
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

function unchanged(original: ReadonlyMap<string, Uint8Array>, changed: ReadonlyMap<string, Uint8Array>) {
  expect([...changed.keys()]).toEqual([...original.keys()])
  for (const [name, bytes] of original) expect(changed.get(name), name).toEqual(bytes)
}

it("leaves every part as it was when an added box, a removed shape and an added slide are taken back", async () => {
  const original = await clean()
  const element = { node: elementId("256.9"), kind: "shape" as const, value: "", box, grouped: false }
  const node = elementId("256.2")
  const key = orderKeyBetween(orderKeyBetween(null, null), null)
  const order = [
    { slide: "element-add", id, element },
    { slide: "element-remove", id, node: element.node },
    { slide: "element-remove", id, node },
    { slide: "element-restore", id, node },
    { slide: "add", id: slideId("257"), after: id, key, layout: id },
    { slide: "remove", id: slideId("257") },
  ] as const
  unchanged(original, orderedParts(original, { file: [id], order }))
})

it("gives a copy the elements its slide showed when it was copied, whatever is taken back later", async () => {
  const original = await clean()
  const element = { node: elementId("256.9"), kind: "shape" as const, value: "", box, grouped: false }
  const node = elementId("256.2")
  const key = orderKeyBetween(orderKeyBetween(null, null), null)
  const shapesOf = (parts: ReadonlyMap<string, Uint8Array>, slide: string) =>
    readShapes(parts)
      .filter((shape) => shape.slide === slide)
      .map((shape) => shape.shape)
  const added = orderedParts(original, {
    file: [id],
    order: [
      { slide: "element-add", id, element },
      { slide: "clone", id: slideId("257"), source: id, key },
      { slide: "element-remove", id, node: element.node },
    ],
  })
  expect(shapesOf(added, "256")).toEqual(["2"])
  expect(shapesOf(added, "257")).toEqual(["2", "9"])
  expect(added.get(part)).toEqual(original.get(part))
  const removed = orderedParts(original, {
    file: [id],
    order: [
      { slide: "element-remove", id, node },
      { slide: "clone", id: slideId("257"), source: id, key },
      { slide: "element-restore", id, node },
    ],
  })
  expect(shapesOf(removed, "256")).toEqual(["2"])
  expect(shapesOf(removed, "257")).toEqual([])
  expect(removed.get(part)).toEqual(original.get(part))
})
