import { Minus } from "lucide-react"
import { designCopy } from "@/copy/design-copy"
import { borderCopy } from "@/copy/border-copy"
import type { PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { borderWidths } from "@/design/appearance-presets"
import { arrange } from "@/design/panel-arrangement"
import { choiceDesc } from "@/design/control-desc"
import { doomControl } from "./design-controls"
import { shownStroke } from "./design-paint-values"
import { emuOf } from "./design-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@/editing/node-props"

const widest = 20_116_800
const routes = ["straight", "elbow", "curve"] as const

export function borderSections(input: ModelInput, kind: PanelKind): PanelSection[] {
  const node = input.view.nodes.get(input.id)
  if (node === undefined) return []
  const shown = shownStroke(propOf(node, "strokes"), propOf(node, "stroke"))
  const options = kind === "connector" ? ["solid", "dash", "dot"] : ["none", "solid", "dash", "dot"]
  const border = doomControl({ trait: "border", field: "border" }, designCopy.border, choiceDesc(options), {
    value: shown.border,
  })
  const styled = shown.border !== "none"
  const color = doomControl(
    { trait: "border", field: "color" },
    borderCopy.color,
    { kind: "color" },
    { value: shown.color },
  )
  const width = doomControl(
    { trait: "border", field: "width" },
    borderCopy.width,
    { kind: "number", unit: "emu", min: 0, max: widest },
    { value: emuOf(shown.weight) },
  )
  const widthLook = {
    ...width,
    look: { ...width.look, name: { show: "above" as const }, glyph: Minus, steps: borderWidths, unit: "" },
  }
  const colorLook = { ...color, look: { ...color.look, name: { show: "above" as const } } }
  const geometry = propOf(node, "geometry")
  const route =
    geometry?.kind === "line"
      ? [
          doomControl({ trait: "border", field: "route" }, borderCopy.route, choiceDesc(routes), {
            value: geometry.route,
          }),
        ]
      : []
  return [
    {
      trait: "border",
      label: designCopy.border,
      open: true,
      strips: arrange("border", [...route, ...(styled ? [border, colorLook, widthLook] : [border])]),
    },
  ]
}
