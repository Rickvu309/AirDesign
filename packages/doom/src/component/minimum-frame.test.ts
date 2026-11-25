import { expect, it } from "vitest"
import { propOf } from "../doom-walk.js"
import { resolveSlide } from "../resolve-slide.js"
import { columnDefinition } from "./library.js"
import { box, frame, instance, land, measure, placed } from "./testing/linked-instance-fixtures.js"

const minimum = columnDefinition.spec.minFrame!

function saved(size: { readonly w: number; readonly h: number }) {
  const before = placed()
  return land(
    before,
    [
      { node: frame, prop: "box", value: { ...box, ...size } },
      { node: frame, prop: "instance", value: instance(before) },
    ],
    true,
  )
}

function paintedBox(view: ReturnType<typeof saved>) {
  const slide = propOf(view.nodes.get(frame), "parent")!.id
  return resolveSlide(view, slide, measure).find(({ id }) => id === frame)?.box
}

it("paints a chart saved below its minimum at the minimum, from its stored corner, and stores nothing", () => {
  const legacy = saved({ w: 110, h: 120 })
  expect(paintedBox(legacy)).toEqual({ ...box, w: minimum.w, h: minimum.h })
  expect(propOf(legacy.nodes.get(frame), "box")).toEqual({ ...box, w: 110, h: 120 })
})

it("paints a chart at or above its minimum at its stored size", () => {
  expect(paintedBox(saved({ w: minimum.w, h: 380 }))).toEqual({ ...box, w: minimum.w, h: 380 })
  expect(paintedBox(placed())).toEqual(box)
})
