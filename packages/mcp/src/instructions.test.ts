import { readSkill } from "@airdesign/skills"
import { expect, it } from "vitest"

import { kindInstructions } from "./index.js"

it("guides agents through slide edits with execute, without the old tools or linked templates", () => {
  expect(kindInstructions()).toContain("airdesign_execute")
  expect(kindInstructions()).toContain("Start with airdesign_get_app_state")
  expect(kindInstructions()).not.toMatch(/airdesign_(create|list|edit|read)_decks?/)
  expect(Math.ceil(Buffer.byteLength(kindInstructions()) / 4)).toBeLessThan(150)
  expect(kindInstructions()).not.toMatch(/Chart a series|clustered-chart|kind component|grammar 1/)
})

it("sends the agent to the slides skill before it designs, and the skill opens", () => {
  const line = kindInstructions()
    .split("\n")
    .find((each) => each.includes("airdesign_read_skill") && each.includes("`slides`"))
  expect(line).toBeDefined()
  expect(readSkill("slides")?.markdown).toContain("# Designing slides")
})
