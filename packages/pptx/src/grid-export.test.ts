declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { gridRows, presentSlides, slideId, type SlideCommand } from "@airdesign/document"
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { exportPackage } from "./export-package.js"

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
