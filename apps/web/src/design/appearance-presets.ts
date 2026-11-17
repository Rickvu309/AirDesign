import type { SetChange } from "@airdesign/document"
import type { PanelKind } from "./panel-order"
import { fillCopy } from "@/copy/fill-copy"
import { lineCopy } from "@/copy/line-copy"
import { designCopy } from "@/copy/design-copy"
import { resolveControl, arrange } from "./panel-arrangement"
import { partControl, type PanelControl, type PanelSection } from "./panel"

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

function pictureValue(value: unknown): boolean {
  return typeof value === "object" && value !== null && "picture" in value
}

function modeList(mode: PanelControl): PanelControl {
  return {
    ...mode,
    desc: { kind: "choice", options: ["fill", "fit", "crop", "tile"] },
    look: { ...mode.look, name: { show: "hidden" }, form: "list" },
  }
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

export function appearanceSections(sections: readonly PanelSection[], kind: PanelKind | null): readonly PanelSection[] {
  const controls = sections.flatMap((section) => section.strips.flat())
  const fill = controls.find((control) => control.trait === "line" && control.field === "fill")
  const dash = controls.find((control) => control.trait === "line" && control.field === "dash")
  const shadow = controls.find((control) => control.trait === "effects" && control.field === "shadow")
  const mode = controls.find((control) => control.trait === "image" && control.field === "mode")
  const overlay = controls.find((control) => control.trait === "image" && control.field === "overlay")
  const blur = controls.find((control) => control.trait === "image" && control.field === "blur")
  const adjust = [overlay, blur].filter((control) => control !== undefined)
  const fillValue = controls.find((control) => control.trait === "fill" && control.field === "value")?.value
  const shapePanel = kind === "shape" || kind === "text"
  const shapePicture = shapePanel && pictureValue(fillValue)
  const added: PanelSection[] =
    kind === "picture"
      ? [
          {
            trait: "pictureFill",
            label: fillCopy.section,
            open: true,
            strips: mode === undefined ? [] : [[modeList(mode)], ...(adjust.length === 0 ? [] : [adjust])],
          },
        ]
      : []
  if (fill !== undefined && dash !== undefined) {
    const border = resolveControl({
      ...fill,
      trait: "border",
      field: "border",
      label: designCopy.border,
      desc: {
        kind: "choice",
        options: kind === "connector" ? ["solid", "dash", "dot"] : ["none", "solid", "dash", "dot"],
      },
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
    const extra: PanelControl[] = []
    if (
      kind === "connector" &&
      dash.value === "solid" &&
      fill.desc.kind === "union" &&
      typeof fill.value === "object" &&
      fill.value !== null &&
      "solid" in fill.value
    ) {
      const desc = fill.desc.cases.solid
      if (desc !== undefined) {
        const color = partControl(fill, "solid", desc, fill.value.solid)
        extra.push({
          ...color,
          label: lineCopy.color,
          look: { ...color.look, name: { show: "above" } },
          change: (value) => fill.change({ solid: value }),
        })
      }
      const width = controls.find((control) => control.trait === "line" && control.field === "width")
      if (width !== undefined) extra.push({ ...width, label: lineCopy.borderWidth })
    }
    added.push({
      trait: "border",
      label: designCopy.border,
      open: true,
      strips: arrange("border", [border, ...extra]),
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
    if (section.trait === "image")
      return {
        ...section,
        strips: section.strips
          .map((strip) =>
            strip.filter((control) => {
              if (shapePanel) return false
              return control.field !== "mode" && control.field !== "overlay" && control.field !== "blur"
            }),
          )
          .filter((strip) => strip.length > 0),
      }
    if (section.trait === "fill" && shapePicture && mode !== undefined)
      return {
        ...section,
        strips: [...section.strips, [modeList(mode)], ...(adjust.length === 0 ? [] : [adjust])],
      }
    const fill =
      section.trait === "line" ? section.strips.flat().find((control) => control.field === "fill") : undefined
    if (fill === undefined || typeof fill.value !== "object" || fill.value === null || !("none" in fill.value))
      return section
    return { ...section, strips: [[fill]] }
  })
  return [...details, ...added].filter((section) => section.trait !== "image" || section.strips.length > 0)
}
