import { elementId, openRegister, slideId, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { busyElements, shownValue } from "./live-repaint"

const node = elementId("256.2")
const box = { x: 1, y: 2, cx: 3, cy: 4 }

it("keeps an element busy until every edit that held it lets go", () => {
  const busy = busyElements()
  const first = busy.hold(node)
  const second = busy.hold(node)
  first()
  first()
  expect(busy.has(node)).toBe(true)
  second()
  expect(busy.has(node)).toBe(false)
})

it("shows the words of a text layer copied inside a group, not the empty text its file holds", () => {
  const words = '[{"from":0,"runs":[{"from":0,"text":"Label"}]}]'
  const layer = elementId("256.7")
  const register: Register = {
    ...openRegister("", "deck"),
    order: [
      {
        slide: "element-clone",
        id: slideId("256"),
        source: elementId("256.4"),
        element: { node: elementId("256.5"), kind: "group", value: null, box, grouped: false },
        layers: [
          {
            source: elementId("256.3"),
            element: { node: layer, kind: "shape", value: words, box, grouped: true, group: elementId("256.5") },
          },
        ],
      },
    ],
  }
  expect(shownValue(register, layer, "")).toBe(words)
})
