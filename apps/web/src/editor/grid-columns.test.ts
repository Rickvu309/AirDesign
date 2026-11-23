import { expect, it } from "vitest"
import { gridBaseColumns } from "@/editor/grid-lines"

it.each([
  [1, 4],
  [4, 4],
  [7, 4],
  [12, 5],
  [24, 6],
  [50, 9],
])("arranges %i slides in %i stable columns", (count, columns) => {
  expect(gridBaseColumns(count)).toBe(columns)
})
