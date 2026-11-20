import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { paintStore } from "./index.js"

const title = elementId("256.2")

it("keeps the fit the slide canvas painted over one a thumbnail painted for the same text", () => {
  const store = paintStore()
  expect(store.getFit(title)).toBeNull()
  store.placeFit(title, { written: "Longer title", scale: 0.85, reduction: 0.1 }, "canvas")
  store.placeFit(title, { written: "Longer title", scale: 0.775, reduction: 0.2 }, "thumbnail")
  expect(store.getFit(title)).toEqual({ written: "Longer title", scale: 0.85, reduction: 0.1 })
  store.placeFit(title, { written: "Longer title again", scale: 0.775, reduction: 0.2 }, "thumbnail")
  expect(store.getFit(title)).toEqual({ written: "Longer title again", scale: 0.775, reduction: 0.2 })
  store.placeFit(title, { written: "Longer title again", scale: 0.7, reduction: 0.2 }, "canvas")
  expect([...store.fits()]).toEqual([[title, { written: "Longer title again", scale: 0.7, reduction: 0.2 }]])
})
