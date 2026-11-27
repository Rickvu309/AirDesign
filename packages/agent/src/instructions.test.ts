import { guide } from "@airdesign/taste"
import { expect, it } from "vitest"

import { instructions } from "./index.js"

it("guides agents through slide edits with execute, without the old tools or linked templates", () => {
  expect(instructions).toContain("airdesign_execute")
  expect(instructions).toContain("Start with airdesign_get_app_state")
  expect(instructions).not.toMatch(/airdesign_(create|list|edit|read)_decks?/)
  expect(instructions).not.toMatch(/Chart a series|clustered-chart|kind component|grammar 1/)
})

it("sends the agent to the slides guide before it designs, and the guide opens", () => {
  const line = instructions
    .split("\n")
    .find((each) => each.includes("airdesign_read_skill") && each.includes("`slides`"))
  expect(line).toContain("Before designing, read the `slides` guide with airdesign_read_skill")
  expect(guide("slides")?.markdown).toContain("# Designing slides")
})

it("calls the execute reference a guide and reserves skill for the tool name", () => {
  expect(instructions).toContain("`execute` guide")
  expect(instructions).not.toMatch(/\bskills?\b/i)
})
