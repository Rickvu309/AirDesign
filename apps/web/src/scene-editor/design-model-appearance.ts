import { opacityWire } from "@airdesign/catalog"
import { designCopy } from "@/copy/design-copy"
import { geometryCopy } from "@/copy/geometry-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { cornerSteps } from "@/design/corners-control"
import { opacitySteps } from "@/design/opacity-control"
import { arrange } from "@/design/panel-arrangement"
import { Opacity } from "@/design/preset-icons"
import { choiceDesc, sceneControl } from "./design-controls"
import { shadowNames, shownShadow } from "./design-paint-values"
import { cornerEmu, wholeFraction } from "./design-values"
import type { ModelInput } from "./design-model"
import { propOf } from "./node-props"

export function opacitySection(input: ModelInput, kind: PanelKind): PanelSection[] {
  const held = propOf(input.view.nodes.get(input.id), "opacity") ?? 1
  const control = sceneControl({ trait: "opacity", field: "opacity" }, opacityCopy.label, opacityWire.desc, {
    value: Math.round(held * wholeFraction),
  })
  const listed = kind !== "connector"
  const shaped: PanelControl = listed
    ? { ...control, look: { ...control.look, glyph: Opacity, steps: opacitySteps } }
    : control
  return [{ trait: "opacity", label: opacityCopy.section, open: true, strips: arrange("opacity", [shaped]) }]
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
  const control = sceneControl(
    { trait: "corners", field: "corners" },
    geometryCopy.corners,
    { kind: "number", unit: "emu", min: 0, max: Math.round(side * cornerEmu) },
    { value: uniform ? Math.round(radius * cornerEmu) : undefined, mixed: !uniform },
  )
  const stepped = { ...control, look: { ...control.look, steps: cornerSteps } }
  return [{ trait: "corners", label: geometryCopy.corners, open: true, strips: arrange("corners", [stepped]) }]
}

export function shadowSection(input: ModelInput): PanelSection[] {
  const node = input.view.nodes.get(input.id)
  if (node === undefined) return []
  const shown = shownShadow(propOf(node, "effects"))
  const preset = sceneControl({ trait: "shadow", field: "shadow" }, designCopy.shadowPreset, choiceDesc(shadowNames), {
    value: shown.name,
  })
  const opacity =
    shown.opacity === null
      ? []
      : [
          sceneControl(
            { trait: "shadow", field: "opacity" },
            opacityCopy.label,
            { kind: "number", unit: "fraction", min: 0, max: wholeFraction },
            { value: Math.round(shown.opacity * wholeFraction) },
          ),
        ]
  return [{ trait: "shadow", label: designCopy.shadow, open: true, strips: arrange("shadow", [preset, ...opacity]) }]
}
