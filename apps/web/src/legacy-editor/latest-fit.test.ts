import { elementId } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { expect, it } from "vitest"
import { latestFit } from "./latest-fit"

it("lets only the newest measure of a layer place its saved box, so an older one never pulls the box back", () => {
  const store = paintStore()
  const node = elementId("256.2")
  const older = latestFit(store, node)
  const newer = latestFit(store, node)
  const other = latestFit(store, elementId("256.3"))
  expect(older()).toBe(false)
  expect(newer()).toBe(true)
  expect(other()).toBe(true)
})
