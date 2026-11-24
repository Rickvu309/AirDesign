import { describe, expect, it } from "vitest"
import { chosenSlides, choiceProblem, firstChoice, problemOn } from "./export-choice"

describe("export choice", () => {
  it("starts on PDF with every slide and the whole deck as the range", () => {
    expect(firstChoice(12)).toEqual({ format: "pdf", slides: "all", from: "1", to: "12" })
  })

  it("chooses every slide in deck order", () => {
    expect(chosenSlides(firstChoice(3), 3, 1)).toEqual([0, 1, 2])
  })

  it("chooses the current slide by its place in the deck", () => {
    expect(chosenSlides({ ...firstChoice(3), slides: "current" }, 3, 2)).toEqual([2])
  })

  it("chooses a range by slide number, first and last included", () => {
    expect(chosenSlides({ ...firstChoice(9), slides: "range", from: "3", to: "5" }, 9, 0)).toEqual([2, 3, 4])
    expect(chosenSlides({ ...firstChoice(9), slides: "range", from: " 4 ", to: "4" }, 9, 0)).toEqual([3])
  })

  it("refuses a range that is not whole slide numbers inside the deck, first before last", () => {
    for (const [from, to] of [
      ["0", "2"],
      ["2", "10"],
      ["5", "3"],
      ["", "3"],
      ["1.5", "3"],
      ["two", "3"],
    ] as const) {
      const choice = { ...firstChoice(9), slides: "range", from, to } as const
      expect(chosenSlides(choice, 9, 0)).toBeNull()
      expect(choiceProblem(choice, 9, [])).toBe("Choose slides from 1 to 9, first slide before last.")
    }
    expect(choiceProblem({ ...firstChoice(9), slides: "range", from: "2", to: "3" }, 9, [])).toBeNull()
    expect(choiceProblem({ ...firstChoice(9), slides: "all", from: "", to: "" }, 9, [])).toBeNull()
  })

  it("says why nothing exports when every chosen slide is skipped, and still exports a skipped current slide", () => {
    const skipped = [true, false, true]
    expect(choiceProblem(firstChoice(3), 3, [true, true, true])).toBe(
      "Every slide is skipped. Unskip a slide to export.",
    )
    expect(choiceProblem(firstChoice(3), 3, skipped)).toBeNull()
    const range = { ...firstChoice(3), slides: "range", from: "3", to: "3" } as const
    expect(choiceProblem(range, 3, skipped)).toBe(
      "Every slide in this range is skipped. Choose another range or unskip a slide.",
    )
    expect(choiceProblem({ ...range, from: "1" }, 3, skipped)).toBeNull()
    expect(choiceProblem({ ...firstChoice(3), slides: "current" }, 3, [true, true, true])).toBeNull()
  })

  it("blames the number fields for a range that does not fit the deck, and the Slides choice for a selection that is all skipped", () => {
    const skipped = [true, false, true]
    expect(problemOn({ ...firstChoice(3), slides: "range", from: "3", to: "1" }, 3, skipped)).toBe("range")
    expect(problemOn({ ...firstChoice(3), slides: "range", from: "3", to: "3" }, 3, skipped)).toBe("slides")
    expect(problemOn(firstChoice(3), 3, [true, true, true])).toBe("slides")
    expect(problemOn(firstChoice(3), 3, skipped)).toBeNull()
  })

  it("reads the range in the numbers the filmstrip shows, so a skipped slide before it leaves them as they are", () => {
    const range = { ...firstChoice(3), slides: "range", from: "3", to: "3" } as const
    expect(chosenSlides(range, 3, 0)).toEqual([2])
  })
})
