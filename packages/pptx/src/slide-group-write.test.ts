declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): string[]
  }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
import { slideId, type SlideCommand, type SlideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { deckDiff } from "./deck-diff.js"
import { readParts } from "./package-container.js"
import { slideAddresses } from "./package-address.js"
import { readSections } from "./section-read.js"
import { orderedParts } from "./slide-order-route.js"

const root = `${process.cwd()}/scripts/pptx-fixtures`
const decks = [
  ...readdirSync(root).map((name) => `${root}/${name}`),
  ...readdirSync(`${root}/corpus`).map((name) => `${root}/corpus/${name}`),
].filter((path) => path.endsWith(".pptx"))

function neighbours(file: readonly SlideId[], sections: readonly (readonly string[])[]): [SlideId, SlideId] | null {
  for (let at = 0; at + 1 < file.length; at += 1) {
    const left = file[at]!
    const right = file[at + 1]!
    if (sections.every((section) => section.includes(left) === section.includes(right))) return [left, right]
  }
  return null
}

function untouched(left: SlideId, right: SlideId): readonly (readonly SlideCommand[])[] {
  return ([3, 2, 1] as const).map((grid) => [
    { slide: "move-many", grid, ids: [right], before: left, row: "before" },
    { slide: "move-many", grid, ids: [right], after: left, row: "same" },
  ])
}

describe("a deck nobody regrouped", () => {
  it("exports every fixture and corpus deck byte for byte after Grid edits that end where they began", async () => {
    expect(decks.length).toBeGreaterThan(40)
    const changed: string[] = []
    let checked = 0
    for (const path of decks) {
      const parts = await readParts(readFileSync(path))
      const file = slideAddresses(parts).map((address) => slideId(address.slide))
      const pair = neighbours(
        file,
        readSections(parts).map((section) => section.slides),
      )
      if (pair === null) continue
      for (const order of untouched(...pair)) {
        const diff = deckDiff(parts, orderedParts(parts, { file, order }))
        checked += 1
        for (const name of [...diff.added, ...diff.removed, ...diff.changed])
          changed.push(`${path.slice(root.length + 1)} grid ${String(order[0]?.grid)} ${name}`)
      }
    }
    expect(checked).toBeGreaterThan(70)
    expect(changed).toEqual([])
  }, 120_000)
})
