declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import {
  nextSlideId,
  orderKeyAfter,
  orderKeyBetween,
  presentSlides,
  slideId,
  type SlideCommand,
  type SlideId,
  type SlideState,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { slideAddresses } from "./package-address.js"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"

const fixture = `${process.cwd()}/scripts/pptx-fixtures/tall-glyph-before.pptx`

function after(file: readonly SlideId[], order: readonly SlideCommand[], command: SlideCommand): SlideState {
  return { file, order: [...order, command] }
}

describe("orderedParts", () => {
  it("adds, clones, removes and moves slides and leaves the first slide untouched", async () => {
    const original = await readParts(readFileSync(fixture))
    const addresses = slideAddresses(original)
    const file = addresses.map((address) => slideId(address.slide))
    const first = file[0]
    const second = file[1]
    const firstPart = addresses[0]?.part
    const secondPart = addresses[1]?.part
    if (first === undefined || second === undefined || firstPart === undefined || secondPart === undefined) {
      throw new Error("slide")
    }
    const opened = presentSlides({ file, order: [] })
    const blankKey = orderKeyAfter(opened, first)
    if (blankKey === null) throw new Error("key")
    const blankId = nextSlideId(file)
    const add: SlideCommand = { slide: "add", id: blankId, after: first, key: blankKey, layout: first }
    const clonedFrom = presentSlides(after(file, [], add))
    const cloneKey = orderKeyAfter(clonedFrom, second)
    if (cloneKey === null) throw new Error("key")
    const cloneId = nextSlideId([...file, blankId])
    const clone: SlideCommand = { slide: "clone", id: cloneId, source: second, key: cloneKey }
    const placed = presentSlides(after(file, [add], clone))
    const blank = placed.find((spot) => spot.id === blankId)
    const hello = placed[0]
    if (blank === undefined || hello === undefined) throw new Error("slide")
    const moveKey = orderKeyBetween(hello.key, blank.key)
    const move: SlideCommand = { slide: "move", id: cloneId, key: moveKey }
    const remove: SlideCommand = { slide: "remove", id: second }
    const state = { file, order: [add, clone, remove, move] }
    expect(presentSlides(state).map((spot) => spot.id)).toEqual([first, cloneId, blankId])
    const exported = orderedParts(original, state)
    const written = slideAddresses(exported)
    expect(written.map((address) => address.slide)).toEqual(["256", "259", "258"])
    expect(exported.get(firstPart)).toEqual(original.get(firstPart))
    expect(exported.has(secondPart)).toBe(false)
    const clonePart = written[1]?.part
    const blankPart = written[2]?.part
    if (clonePart === undefined || blankPart === undefined) throw new Error("slide")
    expect(exported.get(clonePart)).toEqual(original.get(secondPart))
    expect(exported.get(blankPart)).not.toEqual(original.get(secondPart))
  })
})
