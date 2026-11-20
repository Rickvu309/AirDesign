import { afterEach, expect, it } from "vitest"
import { element, line, mounted, pixels, pointer, chosen, unmountAll, upright } from "./connector-canvas-fixture.js"
import type { CanvasElement, PaintBox } from "./index.js"

afterEach(unmountAll)

const ruleBox: PaintBox = { x: 500_000, y: 4_500_000, width: 2_000_000, height: 0, ...upright }
const stroke = { color: "rgb(200, 30, 30)", width: 28_575, dash: null }
const rule: CanvasElement = { ...element(line, "connector", ruleBox, "line"), line: stroke }

it("moves the line itself under a dragged end, in its own stroke, and shows it resting again on release", async () => {
  const { host } = await mounted([rule])
  const resting = host.querySelector<HTMLElement>(`[data-canvas-element="${rule.key}"]`)
  const end = await chosen(host)
  await pointer(end, "pointerdown", pixels(2_500_000), pixels(4_500_000))
  await pointer(end.ownerDocument, "pointermove", pixels(2_500_000), pixels(1_500_000))
  expect(resting?.style.visibility).toBe("hidden")
  expect(host.querySelector<HTMLElement>(`[data-selection="${line}"]`)?.style.visibility).toBe("hidden")
  const live = host.querySelector<HTMLElement>("[data-connector-aim]")
  expect(live?.getAttribute("data-ends")).toBe(
    `${String(pixels(500_000))} ${String(pixels(4_500_000))} ${String(pixels(2_500_000))} ${String(pixels(1_500_000))}`,
  )
  const painted = live?.querySelector("[stroke]")
  expect(painted?.getAttribute("stroke")).toBe(stroke.color)
  expect(live?.querySelector('[stroke-dasharray="4 3"]')).toBeNull()
  await pointer(end.ownerDocument, "pointerup", pixels(2_500_000), pixels(1_500_000))
  expect(host.querySelector("[data-connector-aim]")).toBeNull()
  expect(resting?.style.visibility).toBe("")
  expect(host.querySelector<HTMLElement>(`[data-selection="${line}"]`)?.style.visibility).toBe("")
})
