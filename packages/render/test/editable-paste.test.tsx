import { expect, it } from "vitest"
import { fixtureDeck } from "../../deck/src/fixture.ts"
import { editableRuns } from "../src/editable-runs.ts"

it("keeps the selected run style when Chromium nests pasted markup in the preceding run", () => {
  const element = fixtureDeck(1).slides[0]?.elements[0]
  if (element?.kind !== "text") throw new Error("text fixture required")
  const preceding = { ...element.runs[0], text: "Alpha ", color: "#ff0000", bold: true }
  const selected = { ...element.runs[0], text: "Beta", color: "#0000ff", bold: false }
  const root = document.createElement("div")
  const previous = document.createElement("span")
  previous.dataset.runStyle = JSON.stringify({ ...preceding, text: "" })
  previous.append("Alpha ")
  const pasted = document.createElement("span")
  pasted.style.color = "green"
  pasted.textContent = "Pasted!"
  previous.append(pasted)
  root.append(previous)
  expect(editableRuns(root, [preceding, selected], selected)).toEqual([
    preceding,
    { ...selected, text: "Pasted!" },
  ])
})
