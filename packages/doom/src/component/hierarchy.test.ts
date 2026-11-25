import { expect, it } from "vitest"
import { hierarchy } from "./hierarchy.js"

it("allocates ordered leaf slots, centers branches and marks only focus ancestors", () => {
  expect(
    hierarchy(
      [
        { id: "deep", parent: "left" },
        { id: "root", parent: "" },
        { id: "left", parent: "root" },
        { id: "right", parent: "root" },
      ],
      "deep",
      () => {},
    ),
  ).toMatchObject({
    levels: 3,
    leaves: 2,
    roots: 1,
    rows: [
      { id: "root", parent: "", depth: 0, slot: 0.5, children: 2, focused: true },
      { id: "left", parent: "root", depth: 1, slot: 0, children: 1, focused: true },
      { id: "deep", parent: "left", depth: 2, slot: 0, children: 0, focused: true },
      { id: "right", parent: "root", depth: 1, slot: 1, children: 0, focused: false },
    ],
  })
})

it("renders nodes with missing or cyclic parents and identifies broken relationships", () => {
  const result = hierarchy(
    [
      { id: "a", parent: "b" },
      { id: "b", parent: "a" },
      { id: "c", parent: "unknown" },
    ],
    "",
    () => {},
  )
  expect(result).toMatchObject({ roots: 2, broken: 2, rows: [{ id: "c" }, { id: "a" }, { id: "b" }] })
})
