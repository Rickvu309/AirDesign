import { describe, expect, it } from "vitest"
import { agentKeptLayers, agentLeftLayers, agentUndoStays } from "./agent-runs-copy"

describe("the notes after an Undo on an agent run", () => {
  it("says a kept layer was changed or added to, and that the person can delete it", () => {
    expect(agentKeptLayers("Claude Code", ["“Panel”"])).toBe(
      "“Panel” stays, because you changed it or added to it after Claude Code made it. Delete it yourself if you don't want it.",
    )
    expect(agentKeptLayers("Aira", ["“Panel”", "“Card”"])).toBe(
      "“Panel” and “Card” stay, because you changed them or added to them after Aira made them. Delete them yourself if you don't want them.",
    )
  })

  it("says what to do about a layer left where it is", () => {
    expect(agentLeftLayers(["“Card”"])).toBe(
      "“Card” stays where it is, because the frame it came from was deleted or moved since. Move it yourself if it should go back.",
    )
    expect(agentLeftLayers(["“Card”", "“Logo”"])).toBe(
      "“Card” and “Logo” stay where they are, because the frames they came from were deleted or moved since. Move them yourself if they should go back.",
    )
  })

  it("joins the kept, left and waiting notes in that order", () => {
    const note = agentUndoStays("Aira", { kept: ["“A”"], left: ["“B”"], waiting: ["“C”"] })
    expect(note.indexOf("“A”")).toBeLessThan(note.indexOf("“B”"))
    expect(note.indexOf("“B”")).toBeLessThan(note.indexOf("“C”"))
  })
})
