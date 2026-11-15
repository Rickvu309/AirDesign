import { expect, it } from "vitest"
import { fullNames } from "./before-after.mjs"

it("names each block's full screenshots apart when blocks share a state", () => {
  expect(fullNames([{ state: "design-autofit" }, { state: "agent-empty" }, { state: "design-autofit" }])).toEqual([
    "design-autofit",
    "agent-empty",
    "design-autofit-2",
  ])
})
