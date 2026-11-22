import { expect, it } from "vitest"
import { scene } from "../index.js"

it("hands the scene core to callers through the package index as one namespace", () => {
  const { emptyScene, applyEdit, invert, viewOf, readWrite, readEdit, isRefusal, nodeId, rev, accepts, props } = scene
  expect(typeof applyEdit).toBe("function")
  expect(typeof invert).toBe("function")
  expect(typeof viewOf).toBe("function")
  expect(typeof readWrite).toBe("function")
  expect(typeof readEdit).toBe("function")
  expect(emptyScene.rev).toBe(rev(0))
  expect(isRefusal({ refused: "shape" })).toBe(true)
  expect(isRefusal(emptyScene)).toBe(false)
  expect(nodeId("c:1")).toBe("c:1")
  expect(Object.keys(accepts)).toEqual(["deck", "slideRow", "slide", "frame", "shape"])
  expect(Object.keys(props)).toContain("box")
})
