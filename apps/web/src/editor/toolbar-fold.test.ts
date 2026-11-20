import { expect, it } from "vitest"
import { actionParts, formatParts, insertParts, toolbarFold } from "@/editor/toolbar-fold"

const all = [...insertParts, ...formatParts]

it("keeps every part in the row while nothing folds", () => {
  expect(toolbarFold(all, 0)).toEqual({ row: all, more: [] })
})

it("folds the text controls before any insert tool, so Table, Chart and Icon stay in the row while text is selected", () => {
  expect(toolbarFold(all, 4)).toEqual({
    row: [...insertParts, "styles"],
    more: ["size", "color", "align", "bullets"],
  })
  expect(toolbarFold(all, 5)).toEqual({ row: insertParts, more: formatParts })
})

it("folds the insert tools only once every text control is in More, Add text box last", () => {
  expect(toolbarFold(all, 9)).toEqual({
    row: ["number", "text", "shape"],
    more: ["table", "chart", "image", "icon", ...formatParts],
  })
  expect(toolbarFold(all, all.length - 1).row).toEqual(["text"])
  expect(toolbarFold(all, all.length + 4)).toEqual({ row: [], more: all })
})

it("counts only the parts that show", () => {
  expect(toolbarFold(insertParts, 4)).toEqual({
    row: ["number", "text", "shape"],
    more: ["table", "chart", "image", "icon"],
  })
})

it("folds the slide number before Add text box", () => {
  expect(toolbarFold(insertParts, 6)).toEqual({
    row: ["text"],
    more: ["number", "shape", "table", "chart", "image", "icon"],
  })
})

it("folds Actions before every other part, so the tools a person already reaches keep their place", () => {
  const withActions = [...insertParts, ...formatParts, ...actionParts]
  expect(toolbarFold(withActions, 1)).toEqual({ row: all, more: ["actions"] })
  expect(toolbarFold(withActions, 2).more).toEqual(["bullets", "actions"])
})
