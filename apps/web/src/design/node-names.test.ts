import { expect, it } from "vitest"
import { plainNames } from "./node-names"

it("reads a raw placeholder id as the role a person knows", () => {
  expect(
    plainNames([
      { name: "ctrTitle 0", kind: "shape" },
      { name: "subTitle 1", kind: "shape" },
      { name: "Rectangle 4", kind: "shape" },
      { name: "Oval 5", kind: "shape" },
    ]),
  ).toEqual(["Title", "Subtitle", "Rectangle 4", "Oval 5"])
})

it("keeps a name PowerPoint gave, and numbers two that would read alike", () => {
  expect(
    plainNames([
      { name: "Title 1", kind: "shape" },
      { name: "obj 1", kind: "shape" },
      { name: "obj 2", kind: "shape" },
    ]),
  ).toEqual(["Title 1", "Content 1", "Content 2"])
})

it("names an element that has no name by its kind", () => {
  expect(
    plainNames([
      { name: "", kind: "picture" },
      { name: "", kind: "shape" },
      { name: "", kind: "shape" },
    ]),
  ).toEqual(["Picture", "Shape 1", "Shape 2"])
})
