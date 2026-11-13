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

it("lets an agent set size, a scheme colour, alignment and bullets", () => {
  const value = writeTextValue([
    {
      from: 0,
      align: "center",
      bullet: true,
      runs: [{ from: 0, text: "One", size: 2400, color: { scheme: "accent2" } }],
    },
  ])
  expect(textProblem(floors, [{ node, value, readAt: 1 }])).toBeUndefined()
})

it("refuses a format that is not true or false", () => {
  const value = '[{"from":0,"runs":[{"from":0,"text":"One","bold":"yes"}]}]'
  expect(textProblem(floors, [{ node, value, readAt: 1 }])?.code).toBe("field")
})

it("refuses a size or a colour the file cannot store", () => {
  const size = '[{"from":0,"runs":[{"from":0,"text":"One","size":12}]}]'
  const color = '[{"from":0,"runs":[{"from":0,"text":"One","color":{"rgb":"ff0000"}}]}]'
  expect(textProblem(floors, [{ node, value: size, readAt: 1 }])?.code).toBe("field")
  expect(textProblem(floors, [{ node, value: color, readAt: 1 }])?.code).toBe("field")
})
