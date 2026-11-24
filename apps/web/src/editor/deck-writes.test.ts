import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { deckNodeOf, notesOf, notesWrites, renameWrites } from "./deck-writes"
import { grow, landed } from "@/testing/doom-fixtures"

describe("deck name", () => {
  it("writes the new name on the deck", () => {
    const { view } = grow([])
    const deck = deckNodeOf(view)!
    const after = landed(view, renameWrites(view, "Board update"))
    expect(after.nodes.get(deck)).toMatchObject({ type: "deck", name: "Board update" })
  })
})

describe("presenter notes", () => {
  it("keeps one paragraph per line", () => {
    expect(doom.notesText("one\ntwo").paras).toHaveLength(2)
    expect(doom.notesText("").paras).toHaveLength(1)
  })

  it("writes a slide's notes and reads them back", () => {
    const { view, slides } = grow([])
    const slide = slides[0]!
    expect(notesOf(view, slide)).toBe("")
    const after = landed(view, notesWrites(view, slide, "Open with the number\nthen the plan"))
    expect(notesOf(after, slide)).toBe("Open with the number\nthen the plan")
  })

  it("writes nothing when the words are the same, or the node is not a slide", () => {
    const { view, slides } = grow([])
    expect(notesWrites(view, slides[0]!, "")).toEqual([])
    expect(notesWrites(view, deckNodeOf(view)!, "words")).toEqual([])
  })

  it("replaces the notes the second time", () => {
    const { view, slides } = grow([])
    const first = landed(view, notesWrites(view, slides[0]!, "first"))
    const second = landed(first, notesWrites(first, slides[0]!, "second"))
    expect(notesOf(second, slides[0]!)).toBe("second")
  })
})
