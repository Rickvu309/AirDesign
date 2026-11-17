import { resolveControl } from "@/design/panel-arrangement"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import type { PanelControl } from "../panel"
import { ToggleControl } from "./toggle"

it.each([
  ["text", "bold", "Bold"],
  ["text", "italic", "Italic"],
  ["text", "underline", "Underline"],
  ["box", "flipH", "Flip horizontally"],
  ["box", "flipV", "Flip vertically"],
] satisfies readonly (readonly [PanelControl["trait"], string, string])[])(
  "keeps %s.%s named %s with an icon",
  (trait, field, label) => {
    const control: PanelControl = resolveControl({
      trait,
      field,
      label,
      desc: { kind: "flag" },
      value: true,
      mixed: false,
      inherited: false,
      reset: null,
      change: () => {
        throw new Error("unused")
      },
    })
    const html = renderToStaticMarkup(
      createElement(ToggleControl, { control, palette: { theme: [], deck: [] }, onChange: () => {} }),
    )
    expect(html).toContain(`title="${label}"`)
    expect(html).toContain(`class="sr-only">${label}</span>`)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain("<svg")
  },
)
