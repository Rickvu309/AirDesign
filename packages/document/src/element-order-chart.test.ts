import { expect, it } from "vitest"
import {
  decide,
  elementId,
  openingChart,
  openingElement,
  openRegister,
  slideId,
  writeChartValue,
  type IndexElement,
  type SlideCommand,
} from "./index.js"

const file = [slideId("256")]
const node = elementId("256.9")
const box = { x: 0, y: 0, cx: 100, cy: 50 }
const chart = (value: string | null): IndexElement => ({ node, kind: "chart", value, box, grouped: false })
const added = (value: string | null): SlideCommand => ({ slide: "element-add", id: file[0]!, element: chart(value) })
const slide = (edit: SlideCommand) => decide(openRegister("", ""), { command: "slide", file, edit })

it("adds a chart that carries its data, and refuses one with none or with data no chart is drawn from", () => {
  const value = writeChartValue(openingChart("bar"))
  const decided = slide(added(value))
  if (decided.decision !== "apply") throw new Error(decided.code)
  expect(openingElement(decided.register, node)?.value).toBe(value)
  expect(slide(added(null)).decision).toBe("refuse")
  expect(slide(added("[]")).decision).toBe("refuse")
})
