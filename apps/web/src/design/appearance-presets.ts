import {
  changeEffects,
  opaque,
  readEffects,
  type Alpha,
  type SetChange,
  type ShadowPreset,
  type TraitPatch,
} from "@airdesign/document"
import { Minus } from "lucide-react"
import type { PanelKind } from "./panel-order"
import { fillCopy } from "@/copy/fill-copy"
import { borderCopy } from "@/copy/border-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import { designCopy } from "@/copy/design-copy"
import { resolveControl, arrange } from "./panel-arrangement"
import { partControl, type PanelControl, type PanelReads, type PanelSection } from "./panel"

export const borderWidths = [1, 2, 4, 6, 8] as const

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

function shadowSource(value: unknown): Parameters<typeof readEffects>[0] {
  if (value === undefined) return {}
  return { landed: { shadow: { set: value } } as TraitPatch<"effects"> }
}

function namedShadow(value: string): value is Exclude<ShadowPreset, "custom"> {
  return value === "none" || value === "subtle" || value === "medium" || value === "strong"
}

function shadowValue(shadow: unknown): string | undefined {
  if (shadow === undefined) return "none"
  const read = readEffects(shadowSource(shadow))
  if (read.slide.shadow === "custom") return undefined
  if (typeof shadow === "object" && shadow !== null && "outer" in shadow && read.slide.shadow === "none")
    return undefined
  return read.slide.shadow
}

function shadowChange(shadow: PanelControl, edit: Parameters<typeof changeEffects>[1]): SetChange {
  const sent = shadow.change(shadow.value)
  const pick = changeEffects(readEffects(shadowSource(shadow.value)), edit)
  return pick.ok ? { target: sent.target, effects: pick.effects } : { target: sent.target }
}

function shadowOpacity(shadow: PanelControl): PanelControl | null {
  const read = readEffects(shadowSource(shadow.value))
  if (read.slide.opacity === null || read.slide.shadow === "none" || read.slide.shadow === "custom") return null
  return resolveControl({
    trait: "shadow",
    field: "opacity",
    label: opacityCopy.label,
    desc: { kind: "number", unit: "fraction", min: 0, max: opaque },
    value: read.slide.opacity,
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => {
      const alpha = typeof value === "number" ? Math.max(0, Math.min(opaque, Math.round(value))) : read.slide.opacity
      if (alpha === null) return { target: shadow.change(shadow.value).target }
      return shadowChange(shadow, { slide: { opacity: alpha as Alpha } })
    },
  })
}

const exactFields = ["dash", "cap", "compound", "join", "head", "tail"]

function withImageSettings(
  list: readonly (readonly PanelControl[])[],
  settings: readonly (readonly PanelControl[])[],
): readonly (readonly PanelControl[])[] {
  const at = list.findIndex((strip) => strip.some((control) => control.field === "paint" && imageValue(control.value)))
  return at === -1 ? list : [...list.slice(0, at + 1), ...settings, ...list.slice(at + 1)]
}

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

function stackedShadow(shown: PanelReads | undefined): boolean {
  return ["drop1", "drop2", "drop3"].some((slot) => {
    const value = shown?.fields?.[`effects.${slot}`]?.value
    return typeof value === "object" && value !== null && "outer" in value
  })
}

export function appearanceSections(
  sections: readonly PanelSection[],
  kind: PanelKind | null,
  ends = false,
  shown?: PanelReads,
): readonly PanelSection[] {
  const controls = sections.flatMap((section) => section.strips.flat())
  const fill = controls.find((control) => control.trait === "border" && control.field === "fill")
  const dash = controls.find((control) => control.trait === "border" && control.field === "dash")
  const shadow = controls.find((control) => control.trait === "effects" && control.field === "shadow")
  const mode = controls.find((control) => control.trait === "image" && control.field === "mode")
  const tileScale = controls.find((control) => control.trait === "image" && control.field === "tileScale")
  const placement =
    mode === undefined
      ? []
      : [[modeList(mode)], ...present([mode.value === "tile" ? tileScale : undefined]).map((control) => [control])]
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
            strips: [...placement, ...(adjust.length === 0 ? [] : [adjust])],
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
    const exact = controls.filter(
      (control) =>
        control.trait === "border" &&
        exactFields.includes(control.field) &&
        (ends || (control.field !== "head" && control.field !== "tail")),
    )
    added.push({
      trait: "border",
      label: designCopy.border,
      open: true,
      strips: arrange("border", [border, ...(color === undefined ? [] : present([color, width]))]),
      ...(on ? { designStrips: arrange("border", [border, fill, ...present([width]), ...exact]) } : {}),
    })
  }
  if (shadow !== undefined) {
    const extra = stackedShadow(shown)
    const control = resolveControl({
      ...shadow,
      trait: "shadow",
      field: "shadow",
      label: designCopy.shadowPreset,
      desc: { kind: "choice", options: ["none", "subtle", "medium", "strong"] },
      value: extra ? undefined : shadowValue(shadow.value),
      reset: null,
      change: (value) =>
        typeof value === "string" && namedShadow(value)
          ? shadowChange(shadow, { slide: { shadow: value } })
          : { target: shadow.change(shadow.value).target },
    })
    const opacity = extra ? null : shadowOpacity(shadow)
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
              return !["mode", "tileScale", "overlay", "blur"].includes(control.field)
            }),
          )
          .filter((strip) => strip.length > 0),
      }
    if (section.trait === "fills" && mode !== undefined && (shapePicture || kind === "picture"))
      return {
        ...section,
        ...(shapePicture
          ? { strips: [...section.strips, ...placement, ...(adjust.length === 0 ? [] : [adjust])] }
          : {}),
        ...(section.designStrips === undefined
          ? {}
          : {
              designStrips: withImageSettings(section.designStrips, [
                ...placement,
                ...present([blur]).map((control) => [control]),
              ]),
            }),
      }
    return section
  })
  return [...details.filter((section) => !added.some(({ trait }) => trait === section.trait)), ...added].filter(
    (section) => section.trait !== "image" || section.strips.length > 0,
  )
}
