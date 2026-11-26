import { readSkill } from "@airdesign/skills"
import { expect, it } from "vitest"

import { kindInstructions } from "./index.js"

it("guides agents through slide edits without advertising linked templates", () => {
  expect(kindInstructions()).toContain("airdesign_edit_deck")
  expect(kindInstructions()).not.toMatch(/Chart a series|clustered-chart|kind component|grammar 1/)
})

it("sends the agent to the slides skill before it designs, and the skill opens", () => {
  const line = kindInstructions()
    .split("\n")
    .find((each) => each.includes("airdesign_read_skill") && each.includes("`slides`"))
  expect(line).toBeDefined()
  expect(readSkill("slides")?.markdown).toContain("# Designing slides")
})
