import { scoreWrittenRoute } from "./pptx-route-judge.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const breaking = (tables) => ({
  newValidatorErrors: () => [],
  newDuplicateShapeIds: () => [],
  shapeIdCounts: () => [],
  touchMatches: () => true,
  newTableBreaks: () => tables,
})
const item = {
  run: { operation: "tbl.addRow", error: null, touch: {} },
  exportError: null,
  back: new Map(),
  dangling: [],
}

same("a row write that keeps every table whole passes", scoreWrittenRoute(breaking([]), new Map(), [], item, []), null)
same(
  "a row write that leaves a frame taller or shorter than its rows fails, though the validator sees nothing",
  scoreWrittenRoute(
    breaking([{ part: "ppt/slides/slide1.xml", shape: "7", reason: "height" }]),
    new Map(),
    [],
    item,
    [],
  )?.tables,
  ["height"],
)
same(
  "a row write that leaves a row with fewer cells than the grid fails",
  scoreWrittenRoute(breaking([{ part: "ppt/slides/slide1.xml", shape: "7", reason: "cells" }]), new Map(), [], item, [])
    ?.tables,
  ["cells"],
)
