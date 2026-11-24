declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { slideId, type SlideCommand, type SlideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckDiff } from "./deck-diff.js"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { sectionListFailures } from "./section-check.js"
import { readSections } from "./section-read.js"
import { indexPackage } from "./index-package.js"

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
