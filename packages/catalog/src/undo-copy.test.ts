import { describe, expect, it } from "vitest"
import { undoStaysNote } from "./undo-copy.js"

describe("the notes after an Undo on an agent run", () => {
  it("names the layers that stay and the layers whose later changes were kept", () => {
    expect(undoStaysNote("Aira", { kept: ["“Panel”"], later: ["“Chart”"], left: [], waiting: [] })).toBe(
      "“Panel” stays because it was changed after Aira made it. Later changes to “Chart” were kept.",
    )
    expect(undoStaysNote("Aira", { kept: [], left: [], waiting: [] })).toBe("")
  })

  it("says a left layer stays where it is because the place it came from has changed", () => {
    expect(undoStaysNote("Aira", { kept: [], left: ["“Card”"], waiting: [] })).toBe(
      "“Card” stays where it is, because the place it came from has changed.",
    )
    expect(undoStaysNote("Aira", { kept: [], left: ["“Card”", "“Logo”"], waiting: [] })).toBe(
      "“Card” and “Logo” stay where they are, because the places they came from have changed.",
    )
  })

  it("joins the kept, left and waiting notes in that order", () => {
    const note = undoStaysNote("Aira", { kept: ["“A”"], left: ["“B”"], waiting: ["“C”"] })
    expect(note.indexOf("“A”")).toBeLessThan(note.indexOf("“B”"))
    expect(note.indexOf("“B”")).toBeLessThan(note.indexOf("“C”"))
  })
})
