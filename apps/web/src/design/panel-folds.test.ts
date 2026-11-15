import { expect, it } from "vitest"
import { foldOpen, folds, setFold } from "./panel-folds"

it("remembers a person's folding for each panel kind apart, and falls back to the panel's own", () => {
  expect(foldOpen(folds(), "text", "line", false)).toBe(false)
  setFold("text", "line", true)
  setFold("shape", "fill", false)
  expect(foldOpen(folds(), "text", "line", false)).toBe(true)
  expect(foldOpen(folds(), "shape", "line", true)).toBe(true)
  expect(foldOpen(folds(), "shape", "fill", true)).toBe(false)
  expect(foldOpen(folds(), "picture", "fill", true)).toBe(true)
})
