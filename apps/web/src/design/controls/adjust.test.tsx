import { resolveControl } from "@/design/panel-arrangement"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { geometryCopy } from "@/copy/geometry-copy"
import { AdjustControl } from "./adjust"

function painted(preset: string, value: Readonly<Record<string, number>>): string {
  const control = resolveControl({
    trait: "geometry",
    field: "adjust",
    label: geometryCopy.shape,
    desc: { kind: "named", item: { kind: "number", unit: "count", min: -2_147_483_647, max: 2_147_483_647 }, max: 8 },
    value,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => {
      throw new Error("unused")
    },
  })
  return renderToStaticMarkup(
    createElement(AdjustControl, {
      control: { ...control, parent: { preset } },
      palette: { templateColors: [], deck: [] },
      onChange: () => undefined,
    }),
  )
}

it("names a preset's adjust value and shows it as a percent, and leaves out PowerPoint's aspect factors", () => {
  const star = painted("star5", { adj: 30_000, hf: 105_146, vf: 110_557 })
  expect(star).toContain(geometryCopy.adjust("star5", "adj"))
  expect(star).toContain('value="30"')
  expect(star).toContain("%")
  expect(geometryCopy.adjust("star5", "hf")).toBeUndefined()
  expect(star.match(/<input/g)).toHaveLength(1)
})

it("shows nothing for a preset whose adjusts have no meaningful name", () => {
  expect(painted("leftRightArrowCallout", { adj1: 1, adj2: 2, adj3: 3, adj4: 4 })).toBe("")
})
