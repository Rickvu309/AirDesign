import { expect, it } from "vitest"

import { kindInstructions } from "./index.js"

it("guides agents through slide edits without advertising linked templates", () => {
  expect(kindInstructions()).toContain("airdesign_edit_deck")
  expect(kindInstructions()).not.toMatch(/Chart a series|clustered-chart|kind component|grammar 1/)
})
