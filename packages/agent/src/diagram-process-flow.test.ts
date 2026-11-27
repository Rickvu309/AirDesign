import { describe, expect, it } from "vitest"

import {
  clean,
  type Drawing,
  recipe,
  refused,
  sample,
  styles,
  wellJoined,
  withData,
} from "./testing/diagram-drawing.js"

type Step = { readonly name: string; readonly how: string }

function flowDrawn(drawing: Drawing, steps: readonly Step[], focus: string) {
  const boxes = steps.map((step) => drawing.named(step.name))
  const hows = steps.map((step) => drawing.named(`${step.name} how`))
  wellJoined(boxes, drawing.lines)
  expect(drawing.lines.map((line) => [line.from, line.to])).toEqual(
    boxes.slice(1).map((box, at) => [boxes[at]!.id, box.id]),
  )
  for (const line of drawing.lines) expect(new Set(line.points.map((point) => Math.round(point.y))).size).toBe(1)
  const gaps = boxes.slice(1).map((box, at) => box.box.x - (boxes[at]!.box.x + boxes[at]!.box.w))
  for (const [at, box] of boxes.entries()) {
    expect(box.box.y, box.name).toBe(boxes[0]!.box.y)
    expect(box.box.w, box.name).toBe(boxes[0]!.box.w)
    expect(box.box.h, box.name).toBe(boxes[0]!.box.h)
    expect(hows[at]!.box.x, box.name).toBe(box.box.x)
    expect(hows[at]!.box.y, box.name).toBeGreaterThan(box.box.y + box.box.h)
    expect(hows[at]!.color, box.name).toContain("text2")
    expect(box.fill.includes("accent1"), box.name).toBe(box.name === focus)
  }
  for (const gap of gaps) expect(gap).toBe(gaps[0])
  expect(gaps[0]).toBeGreaterThanOrEqual(64)
}

const longSteps = (count: number): readonly Step[] =>
  Array.from({ length: count }, (_, at) => ({
    name: `Check returned goods ${String(at + 1)}`,
    how: "The hub team checks every item against the receipt and the photos within three working days",
  }))

describe("the process flow recipe", () => {
  for (const style of styles)
    it(`draws its sample in ${style}: steps in one row, attached arrows in order, one step in the accent`, async () => {
      flowDrawn(
        await clean(style, recipe("process-flow")),
        sample("process-flow", "steps"),
        sample("process-flow", "focus"),
      )
    })

  for (const count of [3, 6])
    for (const style of ["consulting", "midnight"])
      it(`holds ${String(count)} steps with long names and long mechanisms in ${style}`, async () => {
        const steps = longSteps(count)
        const focus = steps[1]!.name
        flowDrawn(await clean(style, withData("process-flow", { steps, focus })), steps, focus)
      })

  it("stops with a sentence the agent can act on for 2 or 7 steps", async () => {
    for (const count of [2, 7]) {
      const steps = longSteps(count)
      expect(await refused(withData("process-flow", { steps, focus: steps[0]!.name }))).toContain(
        `A flow takes 3 to 6 steps and this one has ${String(count)}`,
      )
    }
  })
})
