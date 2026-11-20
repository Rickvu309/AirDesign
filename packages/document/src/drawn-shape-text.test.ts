import { expect, it } from "vitest"
import { decide, elementId, openRegister, slideId, type IndexElement } from "./index.js"

const slide = slideId("256")
const node = elementId("256.9")

function typed(value: string | null) {
  const element: IndexElement = { node, kind: "shape", value, box: { x: 0, y: 0, cx: 100, cy: 50 }, grouped: false }
  const edit = { slide: "element-add", id: slide, element, geometry: "rect" } as const
  const added = decide(openRegister("", ""), { command: "slide", file: [slide], edit })
  if (added.decision !== "apply") throw new Error(added.code)
  const opened = decide(added.register, { command: "add", node, floor: "", route: "" })
  if (opened.decision !== "apply") throw new Error(opened.code)
  return decide(opened.register, { command: "person", node, value: "Grow" }).decision
}

it("takes typed text in a drawn shape that holds empty text, and keeps one an older deck drew with none closed to text", () => {
  expect(typed("")).toBe("apply")
  expect(typed(null)).toBe("refuse")
})
