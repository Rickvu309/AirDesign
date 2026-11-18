declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { gridRows, presentSlides, slideId, type SlideCommand } from "@airdesign/document"
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { exportPackage } from "./export-package.js"
import { indexPackage } from "./index-package.js"
import { slideNumbering } from "./slide-numbering.js"

it("exports exactly the original bytes when only grid heads differ", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/sections-before.pptx")
  const parts = await readParts(original)
  const file = [slideId("256"), slideId("257")]
  const spot = presentSlides({ file, order: [] })[1]!
  const edit: SlideCommand = {
    slide: "grid-turn",
    grid: 1,
    turn: {
      spots: [{ id: spot.id, before: { present: true, key: spot.key }, after: { present: true, key: spot.key } }],
      heads: [{ id: spot.id, before: false, after: true }],
      rows: [],
    },
  }
  const state = { file, order: [edit] }
  expect(gridRows(state)).toEqual([[file[0]], [file[1]]])
  const exported = orderedParts(parts, state)
  expect(await exportPackage(original, exported)).toEqual(new Uint8Array(original))
})

it("materializes modern anchored births and their guarded undo without grid parts", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/tall-glyph-before.pptx")
  const parts = await readParts(original)
  const file = [slideId("256"), slideId("257")]
  const add: SlideCommand = {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("258"),
    after: file[0]!,
    layout: file[0]!,
  }
  const clone: SlideCommand = { slide: "clone", grid: 1, id: slideId("259"), source: slideId("258") }
  const out = orderedParts(parts, { file, order: [add, clone] })
  expect(out.get("ppt/slides/slide3.xml")).toBeDefined()
  expect(out.get("ppt/slides/slide4.xml")).toBeDefined()
  expect([...out.keys()].filter((key) => key.includes("grid"))).toEqual([])
})

it("exports the same bytes for below-row and same-row additions with the same flat order", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/sections-before.pptx")
  const parts = await readParts(original)
  const file = [slideId("256"), slideId("257")]
  const below: SlideCommand = {
    slide: "add",
    grid: 1,
    row: "new",
    id: slideId("258"),
    after: file[0]!,
    layout: file[0]!,
  }
  const beside: SlideCommand = {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("258"),
    after: file[1]!,
    layout: file[0]!,
  }
  const newRow = orderedParts(parts, { file, order: [below] })
  const sameRow = orderedParts(parts, { file, order: [beside] })
  expect(gridRows({ file, order: [below] })).toEqual([[...file], ["258"]])
  expect([...newRow.keys()].some((path) => path.includes("grid"))).toBe(false)
  expect(await exportPackage(original, newRow)).toEqual(await exportPackage(original, sameRow))
})

it("round-trips an untouched sectioned import byte for byte after its version two rows are read", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/doe-heat-pumps.pptx")
  const parts = await readParts(original)
  const opening = indexPackage(parts)
  const file = opening.slides.map(({ id }) => slideId(id))
  const index = { ...opening, total: opening.elements.length, pages: [] }
  const state = { file, order: [], index }
  expect(gridRows(state).map((row) => row.length)).toEqual([1, 10, 10, 8, 10, 2])
  expect(await exportPackage(original, orderedParts(parts, state))).toEqual(new Uint8Array(original))
})

it("numbers slides within their stored rows after a version two edit", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/sections-before.pptx")
  const parts = await readParts(original)
  const file = [slideId("256"), slideId("257")]
  const id = slideId("258")
  const edit = { slide: "add", grid: 2, row: "new", id, after: file[0]!, layout: file[0]! } as const
  const state = { file, sectionStarts: file, order: [edit] }
  expect([...slideNumbering(orderedParts(parts, state), state)]).toEqual([
    [file[0], { number: 1, total: 3, rowNumber: 1 }],
    [file[1], { number: 2, total: 3, rowNumber: 2 }],
    [id, { number: 3, total: 3, rowNumber: 1 }],
  ])
})
