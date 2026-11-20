import { expect, it } from "vitest"
import { actionParts, formatParts, insertParts, toolbarFold } from "@/editor/toolbar-fold"

const all = [...insertParts, ...formatParts]

it("keeps every part in the row while nothing folds", () => {
  expect(toolbarFold(all, 0)).toEqual({ row: all, more: [] })
})

it("folds the insert tools before the text controls, keeping the row's order in More", () => {
  expect(toolbarFold(all, 3)).toEqual({
    row: ["number", "text", "shape", "styles", "size", "color", "align", "bullets"],
    more: ["table", "image", "icon"],
  })
  expect(toolbarFold(all, 8)).toEqual({
    row: ["styles", "size", "color"],
    more: ["number", "text", "shape", "table", "image", "icon", "align", "bullets"],
  })
})

it("folds bold, italic and underline last", () => {
  expect(toolbarFold(all, all.length - 1).row).toEqual(["styles"])
  expect(toolbarFold(all, all.length + 4)).toEqual({ row: [], more: all })
})

it("counts only the parts that show", () => {
  expect(toolbarFold(insertParts, 3)).toEqual({ row: ["number", "text", "shape"], more: ["table", "image", "icon"] })
})

it("folds the slide number before Add text box", () => {
  expect(toolbarFold(all, 5)).toEqual({
    row: ["text", "styles", "size", "color", "align", "bullets"],
    more: ["number", "shape", "table", "image", "icon"],
  })
})

it("folds Actions before every other part, so the tools a person already reaches keep their place", () => {
  const withActions = [...insertParts, ...formatParts, ...actionParts]
  expect(toolbarFold(withActions, 1)).toEqual({ row: all, more: ["actions"] })
  expect(toolbarFold(withActions, 2).more).toEqual(["icon", "actions"])
})
