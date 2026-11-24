import { nodeId } from "@airdesign/doom"
import { expect, it } from "vitest"
import { pagesToPrint } from "./printed-slides"

const slides = [nodeId("n:1"), nodeId("n:2"), nodeId("n:3")]

it("omits skipped slides from a whole deck or a range, and keeps the current slide", () => {
  expect(pagesToPrint(slides, [0, 1, 2], [true, false, true], false)).toEqual([slides[1]])
  expect(pagesToPrint(slides, [1, 2], [true, false, true], false)).toEqual([slides[1]])
  expect(pagesToPrint(slides, [0], [true, false, true], true)).toEqual([slides[0]])
})

it("prints nothing when every chosen slide is skipped", () => {
  expect(pagesToPrint(slides, [0, 2], [true, false, true], false)).toBeNull()
})
