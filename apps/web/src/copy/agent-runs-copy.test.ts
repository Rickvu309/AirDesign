import { describe, expect, it } from "vitest"
import { agentKeptLayers, agentLeftLayers, agentUndoStays } from "./agent-runs-copy"

describe("the notes after an Undo on an agent run", () => {
  it("says a kept layer was changed, without saying who changed it, and that the person can delete it", () => {
    expect(agentKeptLayers("Claude Code", ["“Panel”"])).toBe(
      "Changes made to “Panel” after Claude Code’s edit were kept.",
    )
    expect(agentKeptLayers("Aira", ["“Panel”", "“Card”"])).toBe(
      "Changes made to “Panel” and “Card” after Aira’s edit were kept.",
    )
  })

  it("says a left layer stays where it is because the place it came from has changed", () => {
    expect(agentLeftLayers(["“Card”"])).toBe("“Card” stays where it is, because the place it came from has changed.")
    expect(agentLeftLayers(["“Card”", "“Logo”"])).toBe(
      "“Card” and “Logo” stay where they are, because the places they came from have changed.",
    )
  })

  it("joins the kept, left and waiting notes in that order", () => {
    const note = agentUndoStays("Aira", { kept: ["“A”"], left: ["“B”"], waiting: ["“C”"] })
    expect(note.indexOf("“A”")).toBeLessThan(note.indexOf("“B”"))
    expect(note.indexOf("“B”")).toBeLessThan(note.indexOf("“C”"))
  })
})
