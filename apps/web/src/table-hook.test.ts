import {
  decide,
  elementId,
  format,
  openRegister,
  writeTextValue,
  type Command,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { editedRegister } from "./slide-fixtures"
import { structureOf } from "./table-hook"

const picture = elementId("256.4")
const floor = { x: 1, y: 2, cx: 300, cy: 200 }

function sized(commands: readonly Command[]): Register {
  const opened: Register = {
    ...openRegister("", "deck"),
    index: {
      total: 1,
      slides: [],
      pages: [],
      elements: [{ node: picture, kind: "shape", value: null, box: floor, grouped: false }],
    },
  }
  return commands.reduce((register, command) => {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
}

it("repaints the whole deck when text is filled with an image, so the canvas draws the picture from the export", () => {
  const plain = editedRegister([["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hi" }] }])]])
  const typed = editedRegister([["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])]])
  expect(structureOf(typed)).toBe(structureOf(plain))
  const pictured = editedRegister([
    ["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hi", fill: { image: "star" } }] }])],
  ])
  expect(structureOf(pictured)).not.toBe(structureOf(plain))
})

it("repaints when a frame's size changes, and leaves a move on the live box", () => {
  const added = sized([{ command: "add", node: picture, floor: "", route: "deck" }])
  const moved = sized([
    { command: "add", node: picture, floor: "", route: "deck" },
    {
      command: "person",
      node: picture,
      v: format,
      patch: { box: { x: { set: 9 }, y: { set: floor.y }, w: { set: floor.cx }, h: { set: floor.cy } } },
    },
  ])
  const resized = sized([
    { command: "add", node: picture, floor: "", route: "deck" },
    { command: "person", node: picture, v: format, patch: { box: { h: { set: 540 } } } },
  ])
  expect(structureOf(moved)).toBe(structureOf(added))
  expect(structureOf(resized)).not.toBe(structureOf(added))
})
