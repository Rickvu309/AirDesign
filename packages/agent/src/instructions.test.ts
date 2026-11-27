import { readSkill } from "@airdesign/taste"
import { expect, it } from "vitest"

import { instructions } from "./index.js"

it("guides agents through slide edits with execute, without the old tools or linked templates", () => {
  expect(instructions).toContain("airdesign_execute")
  expect(instructions).toContain("Start with airdesign_get_app_state")
  expect(instructions).not.toMatch(/airdesign_(create|list|edit|read)_decks?/)
  expect(Math.ceil(Buffer.byteLength(instructions) / 4)).toBeLessThan(150)
  expect(instructions).not.toMatch(/Chart a series|clustered-chart|kind component|grammar 1/)
})

it("sends the agent to the slides skill before it designs, and the skill opens", () => {
  const line = instructions
    .split("\n")
    .find((each) => each.includes("airdesign_read_skill") && each.includes("`slides`"))
  expect(line).toBeDefined()
  expect(readSkill("slides")?.markdown).toContain("# Designing slides")
})
