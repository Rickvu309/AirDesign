import { expect, it } from "vitest"
import { foldOpen, folds, setFold } from "./panel-folds"

it("remembers a person's folding for each panel kind apart, and opens a section nobody folded", () => {
  expect(foldOpen(folds(), "text", "border")).toBe(true)
  setFold("text", "border", false)
  setFold("shape", "fills", false)
  expect(foldOpen(folds(), "text", "border")).toBe(false)
  expect(foldOpen(folds(), "shape", "border")).toBe(true)
  expect(foldOpen(folds(), "shape", "fills")).toBe(false)
  expect(foldOpen(folds(), "picture", "fills")).toBe(true)
})

it("keeps Shape type open while a text rectangle becomes a drawn shape", () => {
  setFold("text", "geometry", true)
  expect(foldOpen(folds(), "shape", "geometry")).toBe(true)
  setFold("shape", "geometry", false)
  expect(foldOpen(folds(), "text", "geometry")).toBe(false)
})
