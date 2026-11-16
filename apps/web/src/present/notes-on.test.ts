import { expect, it } from "vitest"
import { notesOn } from "./notes-on"

const notes = [
  { slide: "ppt/slides/slide1.xml", text: "Open with the number" },
  { slide: "ppt/slides/slide3.xml", text: "Thank the team" },
]

it("reads the speaker notes of one slide", () => {
  expect(notesOn(notes, "ppt/slides/slide3.xml")).toBe("Thank the team")
})

it("reads nothing for a slide without notes or a slide not painted yet", () => {
  expect(notesOn(notes, "ppt/slides/slide2.xml")).toBe("")
  expect(notesOn(notes, undefined)).toBe("")
})
