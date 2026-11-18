import { expect, it } from "vitest"
import { formatParts, insertParts, toolbarFold } from "@/editor/toolbar-fold"

const all = [...insertParts, ...formatParts]

it("keeps every part in the row while nothing folds", () => {
  expect(toolbarFold(all, 0)).toEqual({ row: all, more: [] })
})

it("folds the insert tools before the text controls, keeping the row's order in More", () => {
  expect(toolbarFold(all, 2)).toEqual({
    row: ["number", "text", "shape", "styles", "size", "color", "align", "bullets"],
    more: ["image", "icon"],
  })
  expect(toolbarFold(all, 7)).toEqual({
    row: ["styles", "size", "color"],
    more: ["number", "text", "shape", "image", "icon", "align", "bullets"],
  })
})

it("folds bold, italic and underline last", () => {
  expect(toolbarFold(all, all.length - 1).row).toEqual(["styles"])
  expect(toolbarFold(all, all.length + 4)).toEqual({ row: [], more: all })
})

it("counts only the parts that show", () => {
  expect(toolbarFold(insertParts, 2)).toEqual({ row: ["number", "text", "shape"], more: ["image", "icon"] })
})
