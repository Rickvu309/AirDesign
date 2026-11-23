declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { orderKeyAfter, presentSlides, slideId, type SlideCommand, type SlideState } from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { samePartBytes } from "./export-package.js"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"
import { readSections } from "./section-read.js"
import { orderedParts } from "./slide-order-route.js"

const folder = `${process.cwd()}/scripts/pptx-fixtures`
const file = [slideId("256"), slideId("257")]

function keyAfter(order: readonly SlideCommand[], id: string) {
  const key = orderKeyAfter(presentSlides({ file, order }), slideId(id))
  if (key === null) throw new Error("key")
  return key
}

function sectionEdits(): SlideState {
  const add: SlideCommand = {
    slide: "add",
    id: slideId("258"),
    after: slideId("256"),
    key: keyAfter([], "256"),
    layout: slideId("256"),
  }
  const clone: SlideCommand = {
    slide: "clone",
    id: slideId("259"),
    source: slideId("257"),
    key: keyAfter([add], "257"),
  }
  const remove: SlideCommand = { slide: "remove", id: slideId("257") }
  const last = presentSlides({ file, order: [add, clone, remove] }).at(-1)?.key ?? null
  const move: SlideCommand = { slide: "move", id: slideId("258"), key: orderKeyBetween(last, null) }
  return { file, order: [add, clone, remove, move] }
}

describe("the sectioned deck fixtures", () => {
  it("start with two sections and end with the sections the slide edits give", async () => {
    const before = await readParts(readFileSync(`${folder}/sections-before.pptx`))
    expect(readSections(before)).toEqual([
      { name: "Opening", slides: ["256"] },
      { name: "Numbers", slides: ["257"] },
    ])
    const after = await readParts(readFileSync(`${folder}/sections-after.pptx`))
    expect(readSections(after)).toEqual([
      { name: "Opening", slides: ["256"] },
      { name: "Numbers", slides: ["259", "258"] },
    ])
    const exported = orderedParts(before, sectionEdits())
    expect(sectionListFailures(exported)).toEqual([])
    expect(samePartBytes(exported, after)).toBe(true)
  })
})
