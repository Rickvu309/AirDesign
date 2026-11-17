declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { gridRows, slideId, type SlideCommand } from "@airdesign/document"
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { slideAddresses } from "./package-address.js"

it("exports atomic group and row moves in row-major order without row metadata", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/corpus/nasa-8ft-tunnel.pptx")
  const parts = await readParts(original)
  const addresses = slideAddresses(parts)
  const file = addresses.map((slide) => slideId(slide.slide))
  const [first, second, third, fourth] = file
  if (first === undefined || second === undefined || third === undefined || fourth === undefined)
    throw new Error("four slides")
  const split: SlideCommand = { slide: "move-many", grid: 1, row: "new", ids: [third, fourth], after: second }
  for (const edit of [
    { slide: "move-many", grid: 1, row: "keep", ids: [fourth, third], after: null },
    { slide: "move-many", grid: 1, row: "same", ids: [third, first], after: fourth },
  ] satisfies SlideCommand[]) {
    const state = { file, order: [split, edit] }
    const exported = orderedParts(parts, state)
    expect(slideAddresses(exported).map((slide) => slide.slide)).toEqual(gridRows(state).flat())
    expect([...exported.keys()].some((path) => path.includes("grid"))).toBe(false)
    for (const address of addresses) expect(exported.get(address.part)).toEqual(parts.get(address.part))
  }
})
