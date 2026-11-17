import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { geometryCopy } from "@/copy/geometry-copy"
import { cornerSteps, cornersSection } from "./corners-control"
import { panelOf } from "./panel"

const view: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 1_905_000, cy: 952_500 },
}

function model(shape: unknown, element = view) {
  return panelOf(element, { reads: {}, moves: true, fields: { "geometry.shape": { value: shape, own: true } } })
}

it.each(["shape", "picture"] as const)(
  "rounds a %s in pixels through its existing geometry and makes zero square",
  (kind) => {
    const panel = model({ preset: "rect", adjust: {} }, { ...view, facts: { ...view.facts, kind } })
    const section = panel.sections.find((section) => section.trait === "corners")
    expect(section?.label).toBe(geometryCopy.corners)
    expect(panel.sections.map((section) => section.trait).slice(2, 5)).toEqual(["opacity", "corners", "border"])
    const control = section?.strips.flat()[0]
    expect(control?.look.steps).toEqual([...cornerSteps])
    expect(control?.value).toBe(0)
    expect(control?.change(20 * 9525)).toEqual({
      target: { node: view.node },
      geometry: { shape: { preset: "roundRect", adjust: { adj: 20000 } } },
    })
    expect(control?.change(0)).toEqual({
      target: { node: view.node },
      geometry: { shape: { preset: "rect", adjust: {} } },
    })
  },
)

it("reads native adjusts including defaults and clamps rounding at half the shorter side", () => {
  const control = (shape: unknown) =>
    model(shape)
      .sections.find((section) => section.trait === "corners")
      ?.strips.flat()[0]
  expect(control({ preset: "roundRect", adjust: { adj: 20000 } })?.value).toBe(190500)
  expect(control({ preset: "roundRect", adjust: {} })?.value).toBe(Math.round((952500 * 16667) / 100000))
  expect(control({ preset: "rect", adjust: {} })?.change(952500)).toMatchObject({
    geometry: { shape: { preset: "roundRect", adjust: { adj: 50000 } } },
  })
  for (const shape of [{ preset: "ellipse", adjust: {} }, { preset: "rightArrow", adjust: {} }, null])
    expect(control(shape)).toBeUndefined()
  expect(
    model({ preset: "rect", adjust: {} }, { ...view, box: { x: 0, y: 0, cx: 0, cy: 0 } }).sections.some(
      (section) => section.trait === "corners",
    ),
  ).toBe(false)
})

it.each(["shape", "picture"] as const)("exports Corners as native %s geometry and keeps other parts", async (kind) => {
  const { deckParts, placed, indexed, landed, painted } = await import("@/parity-probe")
  const { registerScope, planChange } = await import("@airdesign/document")
  const { exportParts, shownGeometry } = await import("@airdesign/pptx")
  const { ensureMarkup } = await import("@/markup")
  await ensureMarkup()
  const parts = await deckParts("doe-heat-pumps.pptx")
  const at = placed(parts, kind, kind === "shape" ? "2797.13" : "2883.13")
  const register = indexed(parts)
  const scope = registerScope(register)
  const element = scope.view(at.node)
  expect(element).toBeDefined()
  if (element === undefined) throw new Error("element")
  const control = cornersSection(element, {
    reads: {},
    moves: true,
    fields: { "geometry.shape": { value: { preset: "rect", adjust: {} }, own: true } },
  })?.strips.flat()[0]
  if (control === undefined) throw new Error("corners")
  const planned = planChange(control.change(20 * 9525), scope)
  if (!planned.ok) throw new Error("change")
  const next = landed(register, [
    { command: "add", node: at.node, floor: "", route: "clean" },
    ...planned.rows.map(({ node, row }) => ({ command: "person" as const, node, ...row })),
  ])
  if (next === null) throw new Error("landed")
  const exported = exportParts(parts, next)
  expect(shownGeometry(exported, at)?.value).toMatchObject({ preset: "roundRect" })
  expect(painted(exported, at)).not.toBe(painted(parts, at))
  for (const [name, bytes] of parts) if (name !== at.part) expect(exported.get(name)).toEqual(bytes)
})
