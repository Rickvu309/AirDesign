import { describe, expect, it } from "vitest"
import { agentKeptLayers, agentLeftLayers, agentUndoStays } from "./agent-runs-copy"

describe("the notes after an Undo on an agent run", () => {
  it("says a kept layer was changed, without saying who changed it, and that the person can delete it", () => {
    expect(agentKeptLayers("Claude Code", ["“Panel”"])).toBe(
      "“Panel” stays, because it, or something in it, was changed after Claude Code made it. Delete it yourself if you don't want it.",
    )
    expect(agentKeptLayers("Aira", ["“Panel”", "“Card”"])).toBe(
      "“Panel” and “Card” stay, because they, or something in them, were changed after Aira made them. Delete them yourself if you don't want them.",
    )
  })

  it("says a left layer's frame was deleted or sits inside it, and never tells the person to move the layer", () => {
    expect(agentLeftLayers(["“Card”"])).toBe(
      "“Card” stays where it is, because the frame it came from, or one above it, was deleted or now sits inside it. Put that frame right, then press Undo again.",
    )
    expect(agentLeftLayers(["“Card”", "“Logo”"])).toBe(
      "“Card” and “Logo” stay where they are, because the frames they came from, or ones above them, were deleted or now sit inside them. Put those frames right, then press Undo again.",
    )
  })

  it("joins the kept, left and waiting notes in that order", () => {
    const note = agentUndoStays("Aira", { kept: ["“A”"], left: ["“B”"], waiting: ["“C”"] })
    expect(note.indexOf("“A”")).toBeLessThan(note.indexOf("“B”"))
    expect(note.indexOf("“B”")).toBeLessThan(note.indexOf("“C”"))
  })
})
