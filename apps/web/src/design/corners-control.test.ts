import { elementId, planChange, registerScope, type ScopedElement } from "@airdesign/document"
import { exportParts, shownGeometry } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { geometryCopy } from "@/copy/geometry-copy"
import { ensureMarkup } from "@/markup"
import { deckParts, indexed, landed, painted, placed, type Parts } from "@/parity-probe"
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

it.each(["shape", "image"] as const)(
  "rounds a %s in pixels through its existing geometry and makes zero square",
  (name) => {
    const element = name === "image" ? { ...view, facts: { ...view.facts, text: false } } : view
    const image = name === "image" ? { "fills.p0": { value: { image: true }, own: true } } : {}
    const fields = { ...image, "geometry.shape": { value: { preset: "rect", adjust: {} }, own: true } }
    const panel = panelOf(element, { reads: {}, moves: true, fields })
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

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function driftedParts(before: Parts, after: Parts, slide: string): readonly string[] {
  return [...before].flatMap(([name, bytes]) => {
    if (name === slide) return []
    const next = after.get(name)
    return next !== undefined && sameBytes(next, bytes) ? [] : [name]
  })
}

it.each(["shape", "image"] as const)("exports Corners as native %s geometry and keeps other parts", async (name) => {
  await ensureMarkup()
  const parts = await deckParts("doe-heat-pumps.pptx")
  const at = placed(parts, "shape", name === "shape" ? "2797.13" : "2883.13")
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
  expect(driftedParts(parts, exported, at.part)).toEqual([])
})
