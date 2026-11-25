import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { moved, noHistory, recorded, turned, type Changed, type Kept, type TextHistory } from "./text-history"

const at = (chars: string, caret = chars.length): Kept => ({
  draft: doom.textFromMarkdown(chars, "body"),
  anchor: caret,
  focus: caret,
})

function typed(history: TextHistory, before: string, insert: string, changed: Changed): TextHistory {
  return recorded(history, at(before), changed, changed.from + insert.length)
}

describe("the text's own undo history", () => {
  it("keeps typed characters at the caret as one step", () => {
    let history = typed(noHistory, "", "C", { from: 0, to: 0, run: "typing" })
    history = typed(history, "C", "o", { from: 1, to: 1, run: "typing" })
    history = typed(history, "Co", "s", { from: 2, to: 2, run: "typing" })
    expect(history.undo.map((kept) => kept.draft.chars)).toEqual([""])
  })

  it("keeps words typed over a selection as one step with the selection they replaced", () => {
    let history = recorded(noHistory, at("Untitled", 0), { from: 0, to: 8, run: "typing" }, 1)
    history = typed(history, "M", "i", { from: 1, to: 1, run: "typing" })
    history = typed(history, "Mi", "n", { from: 2, to: 2, run: "typing" })
    expect(history.undo).toEqual([{ ...at("Untitled"), anchor: 0, focus: 8 }])
  })

  it("keeps an IME commit as its own step after typing", () => {
    let history = typed(noHistory, "Costs fall", " ", { from: 10, to: 10, run: "typing" })
    history = typed(history, "Costs fall ", "東京", { from: 11, to: 11 })
    history = typed(history, "Costs fall 東京", "Z", { from: 13, to: 13, run: "typing" })
    expect(history.undo.map((kept) => kept.draft.chars)).toEqual(["Costs fall", "Costs fall ", "Costs fall 東京"])
  })

  it("starts a new typing step once the caret moves", () => {
    let history = typed(noHistory, "", "a", { from: 0, to: 0, run: "typing" })
    history = moved(history)
    history = typed(history, "a", "b", { from: 1, to: 1, run: "typing" })
    expect(history.undo).toHaveLength(2)
  })

  it("keeps single deletes in a row as one step, apart from the typing before them", () => {
    let history = typed(noHistory, "ab", "c", { from: 2, to: 2, run: "typing" })
    history = recorded(history, at("abc"), { from: 2, to: 3, run: "deleting" }, 2)
    history = recorded(history, at("ab"), { from: 1, to: 2, run: "deleting" }, 1)
    expect(history.undo.map((kept) => kept.draft.chars)).toEqual(["ab", "abc"])
    expect(history.undo[1]).toMatchObject({ anchor: 2, focus: 3 })
  })

  it("puts an undone step back on redo, and a new change forgets the redo", () => {
    const history = typed(noHistory, "Costs fall ", "東京", { from: 11, to: 11 })
    const undone = turned(history, "undo", at("Costs fall 東京"))
    expect(undone?.back.draft.chars).toBe("Costs fall ")
    const redone = turned(undone!.history, "redo", undone!.back)
    expect(redone?.back.draft.chars).toBe("Costs fall 東京")
    const after = typed(undone!.history, "Costs fall ", "Z", { from: 11, to: 11, run: "typing" })
    expect(after.redo).toEqual([])
    expect(turned(noHistory, "undo", at(""))).toBeNull()
  })
})
