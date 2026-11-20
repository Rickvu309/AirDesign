import { describe, expect, it } from "vitest"
import {
  cloneOf,
  decide,
  elementId,
  format,
  groupFrame,
  landedPatch,
  maskTurn,
  openRegister,
  slideId,
  type Box,
  type Command,
  type ElementPatch,
  type IndexElement,
  type Register,
} from "./index.js"
import { rebased, shownPlace } from "./group-space.js"

const slide = slideId("256")
const file = [slide]
const mask = elementId("256.2")
const photo = elementId("256.3")
const made = elementId("256.20")

const maskBox: Box = { x: 100, y: 100, cx: 200, cy: 200 }
const photoBox: Box = { x: 50, y: 50, cx: 600, cy: 400 }

const elements: readonly IndexElement[] = [
  { node: mask, kind: "shape", value: "", box: maskBox, grouped: false },
  { node: photo, kind: "shape", value: "", box: photoBox, grouped: false },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 20, animated: [] }],
    elements,
    pages: [{ once: "page", offset: 0, count: elements.length }],
  },
}

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") throw new Error(opened.code)
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

const row = (node: typeof mask, patch: ElementPatch): Command => ({ command: "person", v: format, patch, node })

const masked = () => ran(indexed, maskTurn(indexed, file, slide, made, [photo, mask], mask)!.commands)

const fitted = (register: Register) => rebased(register, made)?.frame ?? groupFrame(register, made)

describe("A mask group fits its mask, as in Figma", () => {
  it("makes the group's box the mask's box, not the box around every layer", () => {
    const after = masked()
    expect(fitted(after)).toEqual(maskBox)
    expect(shownPlace(after, made)?.box).toEqual(maskBox)
  })

  it("names the new group Mask group", () => {
    const body = masked().elements[made]
    const name = body === undefined ? undefined : landedPatch(body, "text").identity?.name
    expect(name).toEqual({ set: "Mask group" })
  })

  it("still fits the mask after a masked layer moves inside the group", () => {
    const moved = ran(masked(), [row(photo, { box: { x: { set: 900 }, y: { set: 700 } } })])
    expect(shownPlace(moved, made)?.box).toEqual(maskBox)
  })

  it("follows the mask when the mask moves", () => {
    const moved = ran(masked(), [row(mask, { box: { x: { set: 300 } } })])
    expect(shownPlace(moved, made)?.box).toEqual({ ...maskBox, x: 300 })
  })

  it("fits every layer again once the mask is removed", () => {
    const freed = ran(masked(), [row(mask, { identity: { mask: { set: false } } })])
    expect(shownPlace(freed, made)?.box).toEqual(photoBox)
  })

  it("fits every layer while the mask is hidden, since a hidden mask clips nothing", () => {
    const hidden = ran(masked(), [row(mask, { identity: { hidden: { set: true } } })])
    expect(shownPlace(hidden, made)?.box).toEqual(photoBox)
  })

  it("fits the mask of a mask group pasted onto another slide, whose mask flag came with the copy", () => {
    const other = slideId("257")
    const twoSlides: Register = {
      ...indexed,
      index: {
        ...indexed.index!,
        slides: [...indexed.index!.slides, { id: "257", position: 1, free: 20, animated: [] }],
      },
    }
    const grouped = ran(twoSlides, maskTurn(twoSlides, [slide, other], slide, made, [photo, mask], mask)!.commands)
    const pasted = cloneOf(grouped, made, elementId("257.20"), maskBox)
    if (!pasted.ok) throw new Error(pasted.refusal)
    const after = ran(grouped, [{ command: "slide", file: [slide, other], edit: pasted.command }])
    expect(shownPlace(after, elementId("257.20"))?.box).toEqual(maskBox)
  })
})
