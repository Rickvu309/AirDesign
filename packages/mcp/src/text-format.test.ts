import { elementId, writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { textProblem } from "./text-from.js"

const node = elementId("258.7")
const floors = new Map([[node, writeTextValue([{ from: 0, runs: [{ from: 0, text: "One" }] }])]])

it("lets an agent set bold, italic and underline on a run of the file", () => {
  const value = writeTextValue([
    {
      from: 0,
      runs: [
        { from: 0, text: "On", bold: true, underline: false },
        { from: 0, text: "e", italic: true },
      ],
    },
  ])
  expect(textProblem(floors, [{ node, value, readAt: 1 }])).toBeUndefined()
})

it("refuses a format that is not true or false", () => {
  const value = '[{"from":0,"runs":[{"from":0,"text":"One","bold":"yes"}]}]'
  expect(textProblem(floors, [{ node, value, readAt: 1 }])?.code).toBe("field")
})
