import { opacityWire } from "@airdesign/catalog"
import { traits } from "@airdesign/document"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { borderCopy } from "@/copy/border-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import { resolveControl } from "@/design/panel-arrangement"
import type { PanelControl } from "@/design/panel"
import { NumberField } from "./number"
import { PercentControl } from "./percent"

const palette = { theme: [], deck: [] }

function percent(value: number, extra: Partial<PanelControl["look"]>): PanelControl {
  const control = resolveControl({
    trait: "shadow",
    field: "opacity",
    label: opacityCopy.label,
    desc: { kind: "number", unit: "fraction", min: 0, max: 100_000 },
    value,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => {
      throw new Error("unused")
    },
  })
  return { ...control, look: { ...control.look, ...extra } }
}

it("offers the percent list beside the field and marks a preset only when the field matches one", () => {
  const html = renderToStaticMarkup(
    createElement(NumberField, {
      control: percent(37_000, { steps: [100, 75, 50, 25, 10, 0] }),
      palette,
      onChange: () => {},
      unit: designCopy.percent,
      kind: "percent",
    }),
  )
  expect(html).toContain('value="37"')
  expect(html).toContain(`aria-label="${designCopy.list(opacityCopy.label)}"`)
  expect(html).not.toContain('aria-selected="true"')
})

it("shows a shadow opacity slider beside the percent field", () => {
  const html = renderToStaticMarkup(
    createElement(PercentControl, {
      control: percent(25_000, { slider: true, name: { show: "above" } }),
      palette,
      onChange: () => {},
    }),
  )
  expect(html).toContain(`aria-label="${opacityCopy.slider}"`)
  expect(html).toContain(`aria-label="${opacityCopy.shadow}"`)
  expect(html).toContain('type="range"')
  expect(html).toContain('value="25"')
  expect(html).toContain(opacityCopy.label)
  expect(html).not.toContain("title=")
})

it("shows a border width without a point suffix while keeping its stored value", () => {
  const value = 4 * 12700
  const control = resolveControl({
    trait: "border",
    field: "width",
    label: borderCopy.width,
    desc: traits.border.fields.width.desc,
    value,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => {
      throw new Error("unused")
    },
  })
  const html = renderToStaticMarkup(
    createElement(NumberField, {
      control,
      palette,
      onChange: () => {},
      unit: designCopy.points,
      kind: "length",
    }),
  )
  expect(html).toContain('value="4"')
  expect(html).toContain("<svg")
  expect(html).not.toContain(`>${designCopy.points}</span>`)
  expect(control.value).toBe(value)
})

it("leads the opacity value with its glyph and keeps its percentage", () => {
  const control = resolveControl({
    trait: "opacity",
    field: "opacity",
    label: opacityCopy.section,
    desc: opacityWire.desc,
    value: 100000,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => {
      throw new Error("unused")
    },
  })
  const html = renderToStaticMarkup(
    createElement(NumberField, {
      control,
      palette,
      onChange: () => {},
      unit: designCopy.percent,
      kind: "percent",
    }),
  )
  expect(html).toContain('value="100"')
  expect(html).toContain("<svg")
  expect(html).toContain(`>${designCopy.percent}</span>`)
})
