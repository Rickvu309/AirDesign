declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { gridRows, presentSlides, slideId, type SlideCommand, type SlideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckDiff } from "./deck-diff.js"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { sectionListFailures } from "./section-check.js"
import { readSections } from "./section-read.js"
import { exportPackage } from "./export-package.js"
import { indexPackage } from "./index-package.js"
import { slideNumbering } from "./slide-numbering.js"

const heatPumps = () =>
  process.getBuiltinModule("node:fs").readFileSync(process.cwd() + "/scripts/pptx-fixtures/doe-heat-pumps.pptx")

async function heatPumpDeck() {
  const original = heatPumps()
  const parts = await readParts(original)
  const file = indexPackage(parts).slides.map(({ id }) => slideId(id))
  const sections = readSections(parts).map((section) => section.slides.map((id) => slideId(id)))
  return { original, parts, file, sections }
}

function shown(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  return readSections(parts).map((section) => `${section.name} ${String(section.slides.length)}`)
}

function regrouped(before: ReadonlyMap<string, Uint8Array>, after: ReadonlyMap<string, Uint8Array>) {
  const diff = deckDiff(before, after)
  return { parts: [...diff.added, ...diff.removed, ...diff.changed], failures: sectionListFailures(after) }
}

it("exports a slide group moved above another under its own section name", async () => {
  const { parts, file, sections } = await heatPumpDeck()
  const partTwo = sections[2] as [SlideId, ...SlideId[]]
  for (const grid of [2, 3] as const) {
    const edit: SlideCommand = { slide: "move-many", grid, ids: partTwo, after: null, row: "keep" }
    const exported = orderedParts(parts, { file, order: [edit] })
    expect(shown(exported)).toEqual([
      "Part 2: System Design Options/Considerations 10",
      "Introduction 1",
      "Part 1: Basic Principles of Heat Pump Operation 28",
      "Appendices 2",
    ])
    expect(regrouped(parts, exported)).toEqual({ parts: ["ppt/presentation.xml"], failures: [] })
  }
})

it("writes a slide dragged into another slide group into that group's section, and only the section list", async () => {
  const { parts, file, sections } = await heatPumpDeck()
  const first = sections[2]![0]!
  const edit: SlideCommand = { slide: "move-many", grid: 3, ids: [first], after: sections[1]!.at(-1)!, row: "same" }
  const exported = orderedParts(parts, { file, order: [edit] })
  expect(shown(exported)).toEqual([
    "Introduction 1",
    "Part 1: Basic Principles of Heat Pump Operation 29",
    "Part 2: System Design Options/Considerations 9",
    "Appendices 2",
  ])
  expect(regrouped(parts, exported)).toEqual({ parts: ["ppt/presentation.xml"], failures: [] })
})

it("keeps a section's name and slides when its first slide moves to a later line of the same group", async () => {
  const { parts, file, sections } = await heatPumpDeck()
  const partOne = sections[1]!
  for (const grid of [2, 3] as const) {
    const edit: SlideCommand = { slide: "move-many", grid, ids: [partOne[0]!], after: partOne[22]!, row: "same" }
    const exported = orderedParts(parts, { file, sectionStarts: sections.map((run) => run[0]!), order: [edit] })
    expect(shown(exported)).toEqual([
      "Introduction 1",
      "Part 1: Basic Principles of Heat Pump Operation 28",
      "Part 2: System Design Options/Considerations 10",
      "Appendices 2",
    ])
    const written = readSections(exported)[1]!.slides.map((slide) => slideId(slide))
    expect(written[0]).toBe(partOne[1])
    expect(written.toSorted()).toEqual([...partOne].toSorted())
    expect(regrouped(parts, exported)).toEqual({ parts: ["ppt/presentation.xml"], failures: [] })
  }
})

it("writes a slide group made inside a section as a new section after the part that keeps the name", async () => {
  const { parts, file, sections } = await heatPumpDeck()
  const tail = sections[1]!.slice(10) as [SlideId, ...SlideId[]]
  const edit: SlideCommand = { slide: "move-many", grid: 3, ids: tail, after: sections[1]![9]!, row: "new" }
  const exported = orderedParts(parts, { file, order: [edit] })
  expect(shown(exported)).toEqual([
    "Introduction 1",
    "Part 1: Basic Principles of Heat Pump Operation 10",
    "Untitled Section 18",
    "Part 2: System Design Options/Considerations 10",
    "Appendices 2",
  ])
  expect(regrouped(parts, exported)).toEqual({ parts: ["ppt/presentation.xml"], failures: [] })
})

it("exports exactly the original bytes when the slide groups are the file's sections, whatever the rows", async () => {
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

it("writes a slide added in a new slide group as its own section, and one added beside into its anchor's section", async () => {
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
  expect([...sectionListFailures(newRow), ...sectionListFailures(sameRow)]).toEqual([])
  expect(gridRows({ file, order: [below] })).toEqual([[...file], ["258"]])
  expect([...newRow.keys()].some((path) => path.includes("grid"))).toBe(false)
  expect(shown(newRow)).toEqual(["Opening 1", "Numbers 1", "Untitled Section 1"])
  expect(shown(sameRow)).toEqual(["Opening 1", "Numbers 2"])
  expect(deckDiff(newRow, sameRow).changed).toEqual(["ppt/presentation.xml"])
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

it("numbers each slide within its slide group, across the lines of a wrapped section", async () => {
  const { parts, file, sections } = await heatPumpDeck()
  const numbers = slideNumbering(parts)
  expect(numbers.get(file[11]!)).toEqual({ number: 12, total: 41, rowNumber: 11 })
  expect(numbers.get(file[29]!)).toEqual({ number: 30, total: 41, rowNumber: 1 })
  const edit: SlideCommand = { slide: "move-many", grid: 3, ids: [file[29]!], after: file[28]!, row: "same" }
  const joined = slideNumbering(
    orderedParts(parts, { file, sectionStarts: sections.map((run) => run[0]!), order: [edit] }),
  )
  expect(numbers.get(file[30]!)?.rowNumber).toBe(2)
  expect(joined.get(file[29]!)?.rowNumber).toBe(29)
  expect(joined.get(file[30]!)?.rowNumber).toBe(1)
})

it("numbers slides within their slide groups after a version two edit", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/sections-before.pptx")
  const parts = await readParts(original)
  const file = [slideId("256"), slideId("257")]
  const id = slideId("258")
  const edit = { slide: "add", grid: 2, row: "new", id, after: file[0]!, layout: file[0]! } as const
  const state = { file, sectionStarts: file, order: [edit] }
  expect([...slideNumbering(orderedParts(parts, state))]).toEqual([
    [file[0], { number: 1, total: 3, rowNumber: 1 }],
    [file[1], { number: 2, total: 3, rowNumber: 1 }],
    [id, { number: 3, total: 3, rowNumber: 1 }],
  ])
})
