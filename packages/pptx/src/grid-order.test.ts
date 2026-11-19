declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { gridGroups, slideId, type SlideCommand } from "@airdesign/document"
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { slideAddresses } from "./package-address.js"

it("exports atomic group and slide group moves in slide order without slide group metadata", async () => {
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
    expect(slideAddresses(exported).map((slide) => slide.slide)).toEqual(gridGroups(state).flat())
    expect([...exported.keys()].some((path) => path.includes("grid"))).toBe(false)
    for (const address of addresses) expect(exported.get(address.part)).toEqual(parts.get(address.part))
  }
})

it("exports a set of copies in presentation order and keeps the surviving original slide parts", async () => {
  const original = process
    .getBuiltinModule("node:fs")
    .readFileSync(process.cwd() + "/scripts/pptx-fixtures/corpus/nasa-8ft-tunnel.pptx")
  const parts = await readParts(original)
  const addresses = slideAddresses(parts)
  const file = addresses.map((slide) => slideId(slide.slide))
  const [first, second, third, fourth] = file
  if (first === undefined || second === undefined || third === undefined || fourth === undefined)
    throw new Error("four slides")
  const firstCopy = slideId("800"),
    secondCopy = slideId("801")
  const order: readonly SlideCommand[] = [
    {
      slide: "clone-many",
      grid: 1,
      copies: [
        { id: secondCopy, source: third },
        { id: firstCopy, source: first },
      ],
    },
    { slide: "remove-many", grid: 1, ids: [first, second] },
  ]
  const output = orderedParts(parts, { file, order })
  const exported = slideAddresses(output)
  expect(exported.map((slide) => slide.slide)).toEqual([third, firstCopy, secondCopy, fourth, ...file.slice(4)])
  for (const { slide, part } of addresses.slice(2)) {
    expect(exported.find((row) => row.slide === slide)?.part).toBe(part)
    expect(output.get(part)).toEqual(parts.get(part))
  }
  const firstXml = parts.get(addresses[0]!.part)
  const thirdXml = parts.get(addresses[2]!.part)
  expect(firstXml).not.toBe(thirdXml)
  expect(output.get(exported[1]!.part)).toEqual(firstXml)
  expect(output.get(exported[2]!.part)).toEqual(thirdXml)
})
