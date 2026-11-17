import { traits } from "@airdesign/document"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { lineCopy } from "@/copy/line-copy"
import { resolveControl } from "@/design/panel-arrangement"
import { NumberField } from "./number"

it("shows a border width without a point suffix while keeping its stored value", () => {
  const value = 4 * 12700
  const control = resolveControl({
    trait: "line",
    field: "width",
    label: lineCopy.borderWidth,
    desc: traits.line.fields.width.desc,
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
      palette: { theme: [], deck: [] },
      onChange: () => {},
      unit: designCopy.points,
      kind: "length",
    }),
  )
  expect(html).toContain('value="4"')
  expect(html).not.toContain(`>${designCopy.points}</span>`)
  expect(control.value).toBe(value)
})
