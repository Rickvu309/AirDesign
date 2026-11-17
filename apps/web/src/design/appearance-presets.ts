import type { SetChange } from "@airdesign/document"
import { designCopy } from "@/copy/design-copy"
import { resolveControl, arrange } from "./panel-arrangement"
import { type PanelSection } from "./panel"

export const shadowPresets = {
  subtle: {
    outer: {
      blur: 25400,
      distance: 12700,
      direction: 2700000,
      color: { rgb: "000000", transforms: [{ op: "alpha", val: 15000 }] },
    },
  },
  medium: {
    outer: {
      blur: 50800,
      distance: 25400,
      direction: 2700000,
      color: { rgb: "000000", transforms: [{ op: "alpha", val: 25000 }] },
    },
  },
  strong: {
    outer: {
      blur: 101600,
      distance: 50800,
      direction: 2700000,
      color: { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }] },
    },
  },
} as const

function borderValue(fill: unknown, dash: unknown): string | undefined {
  if (typeof fill !== "object" || fill === null) return undefined
  if ("none" in fill) return "none"
  return "solid" in fill && (dash === "solid" || dash === "dash" || dash === "dot") ? dash : undefined
}

function shadowValue(shadow: unknown): string | undefined {
  if (shadow === undefined || (typeof shadow === "object" && shadow !== null && "none" in shadow)) return "none"
  return Object.entries(shadowPresets).find(([, value]) => {
    if (typeof shadow !== "object" || shadow === null || !("outer" in shadow)) return false
    const outer = shadow.outer
    if (typeof outer !== "object" || outer === null) return false
    return Object.entries(value.outer).every(
      ([key, expected]) => key in outer && JSON.stringify(Reflect.get(outer, key)) === JSON.stringify(expected),
    )
  })?.[0]
}

export function appearanceSections(sections: readonly PanelSection[]): readonly PanelSection[] {
  const controls = sections.flatMap((section) => section.strips.flat())
  const fill = controls.find((control) => control.trait === "line" && control.field === "fill")
  const dash = controls.find((control) => control.trait === "line" && control.field === "dash")
  const shadow = controls.find((control) => control.trait === "effects" && control.field === "shadow")
  const added: PanelSection[] = []
  if (fill !== undefined && dash !== undefined) {
    const border = resolveControl({
      ...fill,
      trait: "border",
      field: "border",
      label: designCopy.border,
      desc: { kind: "choice", options: ["none", "solid", "dash", "dot"] },
      value: borderValue(fill.value, dash.value),
      reset: null,
      change: (value): SetChange => {
        if (value === "none") return fill.change({ none: true })
        if (value !== "solid" && value !== "dash" && value !== "dot") return fill.change(fill.value)
        const color =
          typeof fill.value === "object" && fill.value !== null && "solid" in fill.value
            ? fill.value
            : { solid: { scheme: "tx1" } }
        const change = fill.change(color)
        return { ...change, line: { ...change.line, dash: value } }
      },
    })
    added.push({
      trait: "border",
      label: designCopy.border,
      open: true,
      strips: arrange("border", [border]),
    })
  }
  if (shadow !== undefined) {
    const control = resolveControl({
      ...shadow,
      trait: "shadow",
      field: "shadow",
      label: designCopy.shadowPreset,
      desc: { kind: "choice", options: ["none", "subtle", "medium", "strong"] },
      value: shadowValue(shadow.value),
      reset: null,
      change: (value) =>
        shadow.change(
          value === "subtle" || value === "medium" || value === "strong" ? shadowPresets[value] : { none: true },
        ),
    })
    added.push({ trait: "shadow", label: designCopy.shadow, open: true, strips: arrange("shadow", [control]) })
  }
  const details = sections.map((section) => {
    const fill =
      section.trait === "line" ? section.strips.flat().find((control) => control.field === "fill") : undefined
    if (fill === undefined || typeof fill.value !== "object" || fill.value === null || !("none" in fill.value))
      return section
    return { ...section, strips: [[fill]] }
  })
  return [...details, ...added]
}
