import { writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { editedRegister } from "./slide-fixtures"
import { structureOf } from "./table-hook"

it("repaints the whole deck when text is filled with an image, so the canvas draws the picture from the export", () => {
  const plain = editedRegister([["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hi" }] }])]])
  const typed = editedRegister([["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])]])
  expect(structureOf(typed)).toBe(structureOf(plain))
  const pictured = editedRegister([
    ["256.2", writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hi", fill: { image: "star" } }] }])],
  ])
  expect(structureOf(pictured)).not.toBe(structureOf(plain))
})
