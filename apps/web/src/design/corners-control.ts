import { keptRefuses, type ScopedElement, type SetChange } from "@airdesign/document"
import { adjustDefaults } from "@airdesign/render"
import { geometryCopy } from "@/copy/geometry-copy"
import { arrange, resolveControl } from "./panel-arrangement"
import type { PanelReads, PanelSection } from "./panel"

export function cornersSection(view: ScopedElement, shown: PanelReads): PanelSection | null {
  if (view.facts.kind !== "shape" && view.facts.kind !== "picture") return null
  if (keptRefuses(view.kept, "geometry", "shape")) return null
  const shape = shown.fields?.["geometry.shape"]?.value
  if (typeof shape !== "object" || shape === null || !("preset" in shape)) return null
  if (shape.preset !== "rect" && shape.preset !== "roundRect") return null
  const side = Math.min(view.box?.cx ?? 0, view.box?.cy ?? 0)
  if (side <= 0) return null
  const adjusts = "adjust" in shape ? shape.adjust : undefined
  const adj =
    typeof adjusts === "object" && adjusts !== null && "adj" in adjusts && typeof adjusts.adj === "number"
      ? adjusts.adj
      : (adjustDefaults("roundRect").adj ?? 16667)
  const control = resolveControl({
    trait: "corners",
    field: "corners",
    label: geometryCopy.corners,
    desc: { kind: "number", unit: "emu", min: 0, max: side },
    value: shape.preset === "rect" ? 0 : Math.round((side * Math.max(0, Math.min(50000, adj))) / 100000),
    mixed: false,
    inherited: false,
    reset: null,
    change: (value): SetChange => {
      const radius = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(side / 2, value)) : 0
      return {
        target: { node: view.node },
        geometry: {
          shape:
            radius === 0
              ? { preset: "rect", adjust: {} }
              : { preset: "roundRect", adjust: { adj: Math.max(1, Math.round((radius / side) * 100000)) } },
        },
      }
    },
  })
  return { trait: "corners", label: geometryCopy.corners, open: true, strips: arrange("corners", [control]) }
}
