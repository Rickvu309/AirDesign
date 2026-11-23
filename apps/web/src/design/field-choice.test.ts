import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { optionWord } from "@/copy/option-copy"
import { choiceLayout } from "./panel-arrangement"

it("names every text alignment, justify included", () => {
  expect(doom.paragraphAligns.map((option) => optionWord("align", option))).toEqual([
    "Left",
    "Center",
    "Right",
    "Justify",
  ])
})

it("names autofit's choices in PowerPoint's words", () => {
  expect(["none", "shrink", "grow"].map((option) => optionWord("autofit", option))).toEqual([
    "Do not Autofit",
    "Shrink text on overflow",
    "Resize shape to fit text",
  ])
})

it("lists autofit's choices, since its words are too long for a segment", () => {
  expect(choiceLayout("autofit", ["none", "shrink", "grow"])).toBe("list")
})

it("keeps short choices as segments and long lists as a list", () => {
  expect(choiceLayout("anchor", ["t", "ctr", "b"])).toBe("segments")
  expect(choiceLayout("vertical", ["horz", "vert", "vert270"])).toBe("segments")
  expect(choiceLayout("dash", ["solid", "dot", "dash", "lgDash", "dashDot"])).toBe("list")
})
