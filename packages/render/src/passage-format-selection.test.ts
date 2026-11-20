import { elementId, type TextRange, type TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { formatTarget } from "./passage-format.js"
import { textFormatting } from "./text-formatting.js"

const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "Introduction to Heat Pumps" }] }]

it("tells the panel when the selected words change, after it keeps them", () => {
  const formatting = textFormatting()
  const id = elementId("256.2")
  const shown = document.createElement("div")
  document.body.append(shown)
  let carets: TextRange | null = null
  formatTarget(formatting, id, shown, {
    current: { look: undefined, read: () => ({ value, carets }), edit: () => undefined },
  })
  formatting.aim(id, shown)
  const seen: boolean[] = []
  formatting.subscribe(() => seen.push(formatting.selection()))
  carets = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 12 } }
  shown.dispatchEvent(new KeyboardEvent("keydown"))
  expect(seen.at(-1)).toBe(true)
  const heard = seen.length
  shown.dispatchEvent(new KeyboardEvent("keydown"))
  expect(seen.length).toBe(heard)
})

it("names the text a person is typing in, and none once focus moves to the layer", () => {
  const formatting = textFormatting()
  const id = elementId("256.2")
  const shown = document.createElement("div")
  const layer = document.createElement("div")
  layer.append(shown)
  document.body.append(layer)
  formatTarget(formatting, id, shown, {
    current: { look: undefined, read: () => ({ value, carets: null }), edit: () => undefined },
  })
  formatting.aim(id, shown)
  expect(formatting.typingIn()).toBe(shown)
  formatting.aim(id, layer)
  expect(formatting.typingIn()).toBeNull()
})
