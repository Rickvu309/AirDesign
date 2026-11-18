import { alphaOf, fadedColor, opaque, sameColor, type Color, type SetChange } from "@airdesign/document"
import { Minus } from "lucide-react"
import type { PanelKind } from "./panel-order"
import { fillCopy } from "@/copy/fill-copy"
import { borderCopy } from "@/copy/border-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import { designCopy } from "@/copy/design-copy"
import { resolveControl, arrange } from "./panel-arrangement"
import { partControl, type PanelControl, type PanelSection } from "./panel"

export const borderWidths = [1, 2, 4, 6, 8] as const

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

function imageValue(value: unknown): boolean {
  return typeof value === "object" && value !== null && "image" in value
}

function modeList(mode: PanelControl): PanelControl {
  return {
    ...mode,
    desc: { kind: "choice", options: ["fill", "fit", "crop", "tile"] },
    look: { ...mode.look, name: { show: "hidden" }, form: "list" },
  }
}

type Outer = {
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly color: Color
}

function readOuter(shadow: unknown): Outer | null {
  if (typeof shadow !== "object" || shadow === null || !("outer" in shadow)) return null
  const outer = shadow.outer
  if (typeof outer !== "object" || outer === null) return null
  const blur = "blur" in outer ? outer.blur : undefined
  const distance = "distance" in outer ? outer.distance : undefined
  const direction = "direction" in outer ? outer.direction : undefined
  const color = "color" in outer ? outer.color : undefined
  if (typeof blur !== "number" || typeof distance !== "number" || typeof direction !== "number") return null
  if (typeof color !== "object" || color === null) return null
  if (!("rgb" in color) && !("scheme" in color) && !("system" in color) && !("preset" in color)) return null
  return { blur, distance, direction, color: color as Color }
}

function sameStrength(outer: Outer, expected: (typeof shadowPresets)[keyof typeof shadowPresets]["outer"]): boolean {
  return (
    outer.blur === expected.blur &&
    outer.distance === expected.distance &&
    outer.direction === expected.direction &&
    sameColor(fadedColor(outer.color, opaque), fadedColor(expected.color, opaque))
  )
}

function shadowValue(shadow: unknown): string | undefined {
  if (shadow === undefined || (typeof shadow === "object" && shadow !== null && "none" in shadow)) return "none"
  const outer = readOuter(shadow)
  if (outer === null) return undefined
  return Object.entries(shadowPresets).find(([, preset]) => sameStrength(outer, preset.outer))?.[0]
}

function shadowOpacity(shadow: PanelControl): PanelControl | null {
  const named = shadowValue(shadow.value)
  const outer = readOuter(shadow.value)
  if (outer === null || named === undefined || named === "none") return null
  return resolveControl({
    trait: "shadow",
    field: "opacity",
    label: opacityCopy.label,
    desc: { kind: "number", unit: "fraction", min: 0, max: opaque },
    value: alphaOf(outer.color),
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => {
      const alpha = typeof value === "number" ? Math.max(0, Math.min(opaque, Math.round(value))) : alphaOf(outer.color)
      return shadow.change({
        outer: {
          blur: outer.blur,
          distance: outer.distance,
          direction: outer.direction,
          color: fadedColor(outer.color, alpha),
        },
      })
    },
  })
}

const exactFields = ["dash", "cap", "compound", "join", "head", "tail"]

function present(controls: readonly (PanelControl | undefined)[]): readonly PanelControl[] {
  return controls.filter((control) => control !== undefined)
}

function colorControl(fill: PanelControl): PanelControl | undefined {
  const desc = fill.desc.kind === "union" ? fill.desc.cases.solid : undefined
  if (desc === undefined || typeof fill.value !== "object" || fill.value === null || !("solid" in fill.value))
    return undefined
  const color = partControl(fill, "solid", desc, fill.value.solid)
  return {
    ...color,
    field: "color",
    label: borderCopy.color,
    look: { ...color.look, name: { show: "above" } },
    change: (value) => fill.change({ solid: value }),
  }
}

function widthControl(controls: readonly PanelControl[]): PanelControl | undefined {
  const width = controls.find((control) => control.trait === "border" && control.field === "width")
  return width === undefined
    ? undefined
    : {
        ...width,
        label: borderCopy.width,
        look: { ...width.look, name: { show: "above" }, glyph: Minus, steps: borderWidths, unit: "" },
      }
}

export function appearanceSections(sections: readonly PanelSection[], kind: PanelKind | null): readonly PanelSection[] {
  const controls = sections.flatMap((section) => section.strips.flat())
  const fill = controls.find((control) => control.trait === "border" && control.field === "fill")
  const dash = controls.find((control) => control.trait === "border" && control.field === "dash")
  const shadow = controls.find((control) => control.trait === "effects" && control.field === "shadow")
  const mode = controls.find((control) => control.trait === "image" && control.field === "mode")
  const overlay = controls.find((control) => control.trait === "image" && control.field === "overlay")
  const blur = controls.find((control) => control.trait === "image" && control.field === "blur")
  const adjust = [overlay, blur].filter((control) => control !== undefined)
  const fillValue = controls.find((control) => control.trait === "fills" && control.field === "paint")?.value
  const shapePanel = kind === "shape" || kind === "text"
  const shapePicture = shapePanel && imageValue(fillValue)
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
        return { ...change, border: { ...change.border, dash: value } }
      },
    })
    const on = !(typeof fill.value === "object" && fill.value !== null && "none" in fill.value)
    const styled = dash.value === "solid" || dash.value === "dash" || dash.value === "dot"
    const width = widthControl(controls)
    const color = styled ? colorControl(fill) : undefined
    const exact = controls.filter((control) => control.trait === "border" && exactFields.includes(control.field))
    added.push({
      trait: "border",
      label: designCopy.border,
      open: true,
      strips: arrange("border", [border, ...(color === undefined ? [] : present([color, width]))]),
      ...(on ? { designStrips: arrange("border", [border, fill, ...present([width]), ...exact]) } : {}),
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
    const opacity = shadowOpacity(shadow)
    added.push({
      trait: "shadow",
      label: designCopy.shadow,
      open: true,
      strips: arrange("shadow", opacity === null ? [control] : [control, opacity]),
    })
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
    if (section.trait === "fills" && shapePicture && mode !== undefined)
      return {
        ...section,
        strips: [...section.strips, [modeList(mode)], ...(adjust.length === 0 ? [] : [adjust])],
      }
    return section
  })
  return [...details.filter((section) => !added.some(({ trait }) => trait === section.trait)), ...added].filter(
    (section) => section.trait !== "image" || section.strips.length > 0,
  )
}
