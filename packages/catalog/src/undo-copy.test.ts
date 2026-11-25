import { describe, expect, it } from "vitest"
import { undoRebuildFailed, undoStaysNote } from "./undo-copy.js"

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

  it("gives a way forward when a linked chart cannot be restored", () => {
    expect(undoRebuildFailed).toBe("Unable to undo. The linked chart can’t be restored. Edit the slide directly.")
  })

  it("joins the kept, left and waiting notes in that order", () => {
    const note = undoStaysNote("Aira", { kept: ["“A”"], left: ["“B”"], waiting: ["“C”"] })
    expect(note.indexOf("“A”")).toBeLessThan(note.indexOf("“B”"))
    expect(note.indexOf("“B”")).toBeLessThan(note.indexOf("“C”"))
  })

  it("names a deleted component whose update the undo skipped", () => {
    expect(undoStaysNote("Aira", { kept: [], left: [], waiting: [], skipped: ["“Tile”"] })).toBe(
      "The component “Tile” was deleted, so its update wasn't undone.",
    )
    expect(undoStaysNote("Aira", { kept: [], left: [], waiting: [], skipped: ["“Tile”", "“Matrix”"] })).toBe(
      "The components “Tile” and “Matrix” were deleted, so their updates weren't undone.",
    )
  })
})
