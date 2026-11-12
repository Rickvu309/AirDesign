import { elementId, writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { textProblem } from "./text-from.js"

it("treats notes as plain text even when the imported note looks like a JSON text value", () => {
  const node = elementId("256.notes")
  const floor = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Example JSON" }] }])
  expect(textProblem(new Map([[node, floor]]), [{ node, value: "Ordinary speaker notes", readAt: 0 }])).toBeUndefined()
})
