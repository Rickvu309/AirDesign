import { designCopy } from "@/copy/design-copy"
import { geometryCopy } from "@/copy/geometry-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { cornerSteps } from "@/design/corners-control"
import { opacityDesc, opacitySteps } from "@/design/opacity-control"
import { arrange } from "@/design/panel-arrangement"
import { Opacity } from "@/design/preset-icons"
import { choiceDesc } from "@/design/control-desc"
import { doomControl } from "./design-controls"
import { shadowNames, shownShadow } from "./design-paint-values"
import { cornerEmu, wholeFraction } from "./design-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@airdesign/doom"

export function opacitySection(input: ModelInput, kind: PanelKind): PanelSection[] {
  const held = propOf(input.view.nodes.get(input.id), "opacity") ?? 1
  const control = doomControl({ trait: "opacity", field: "opacity" }, opacityCopy.label, opacityDesc, {
    value: Math.round(held * wholeFraction),
  })
  const listed = kind !== "connector"
  const shaped: PanelControl = listed
    ? { ...control, look: { ...control.look, glyph: Opacity, steps: opacitySteps } }
    : control
  return [{ trait: "opacity", label: opacityCopy.section, strips: arrange("opacity", [shaped]) }]
}

export function cornersSection(input: ModelInput): PanelSection[] {
  const node = input.view.nodes.get(input.id)
  const geometry = propOf(node, "geometry")
  const box = propOf(node, "box")
  if (node === undefined || box === undefined) return []
  if (node.type === "shape" && geometry !== undefined && geometry.kind !== "rect") return []
  const side = Math.min(box.w, box.h) / 2
  if (side <= 0) return []
  const radius = propOf(node, "radius") ?? 0
  const uniform = typeof radius === "number"
  const control = doomControl(
    { trait: "corners", field: "corners" },
    geometryCopy.corners,
    { kind: "number", unit: "emu", min: 0, max: Math.round(side * cornerEmu) },
    { value: uniform ? Math.round(radius * cornerEmu) : undefined, mixed: !uniform },
  )
  const stepped = { ...control, look: { ...control.look, steps: cornerSteps } }
  return [{ trait: "corners", label: geometryCopy.corners, strips: arrange("corners", [stepped]) }]
}

export function shadowSection(input: ModelInput): PanelSection[] {
  const node = input.view.nodes.get(input.id)
  if (node === undefined) return []
  const shown = shownShadow(propOf(node, "effects"), input.theme)
  const preset = doomControl({ trait: "shadow", field: "shadow" }, designCopy.shadowPreset, choiceDesc(shadowNames), {
    value: shown.name,
  })
  const opacity =
    shown.opacity === null
      ? []
      : [
          doomControl({ trait: "shadow", field: "opacity" }, opacityCopy.label, opacityDesc, {
            value: Math.round(shown.opacity * wholeFraction),
          }),
        ]
  return [{ trait: "shadow", label: designCopy.shadow, strips: arrange("shadow", [preset, ...opacity]) }]
}
