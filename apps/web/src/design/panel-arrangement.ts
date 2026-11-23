import {
  ALargeSmall,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
  Minus,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react"
import {
  SolidBorder,
  DashedBorder,
  DottedBorder,
  StraightLine,
  ElbowLine,
  CurvedLine,
  SoftShadow,
  LiftedShadow,
  GlowShadow,
  fillIcons,
  AlignLeftEdge,
  AlignHorizontalCenter,
  AlignRightEdge,
  AlignTopEdge,
  AlignVerticalCenter,
  AlignBottomEdge,
} from "./preset-icons"
import { LineHeightIcon, LetterSpacingIcon } from "./text-icons"
import { optionWord } from "@/copy/option-copy"
import type { Desc } from "./control-desc"
import type { PanelControl, SectionName } from "./panel"

export type NameLook =
  | { readonly show: "above" }
  | { readonly show: "beside" }
  | { readonly show: "hidden" }
  | { readonly show: "inside" }
  | { readonly show: "icon"; readonly icon: LucideIcon }
  | { readonly show: "letter"; readonly letter: string }

export type ControlLook = {
  readonly name: NameLook
  readonly options: Readonly<Record<string, LucideIcon | undefined>>
  readonly form: "segments" | "list" | "grid" | "header"
  readonly glyph?: LucideIcon
  readonly steps?: readonly number[]
  readonly slider?: boolean
  readonly unit?: string
}

type Placed = {
  readonly field: string
  readonly name: NameLook
  readonly kind?: ControlKind
  readonly options?: Readonly<Record<string, LucideIcon>>
  readonly form?: "segments" | "list" | "grid"
  readonly unit?: string
  readonly glyph?: LucideIcon
  readonly steps?: readonly number[]
  readonly slider?: boolean
}

type Strip = readonly Placed[]

export const iconWeightSteps = [1, 1.5, 2, 2.5, 3] as const
const above: NameLook = { show: "above" }
const hidden: NameLook = { show: "hidden" }
const inside: NameLook = { show: "inside" }
const fills = fillIcons
const placed = (field: string, name: NameLook = above, rest: Omit<Placed, "field" | "name"> = {}): Placed => ({
  field,
  name,
  ...rest,
})
const icon = (field: string, glyph: LucideIcon): Placed => placed(field, { show: "icon", icon: glyph })

export const sectionStrips: Readonly<Record<SectionName, readonly Strip[]>> = {
  link: [[placed("target", hidden)]],
  text: [
    [placed("style", hidden)],
    [placed("font", hidden)],
    [placed("weight", above, { form: "list" }), placed("size", above)],
    [icon("lineHeight", LineHeightIcon), icon("letterSpacing", LetterSpacingIcon)],
    [icon("bold", Bold), icon("italic", Italic), icon("underline", Underline), icon("strike", Strikethrough)],
    [
      placed("align", hidden, {
        form: "segments",
        options: { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify },
      }),
      placed("list", hidden, { form: "segments", options: { none: Minus, bullets: List, numbers: ListOrdered } }),
    ],
    [
      placed("case", hidden, {
        form: "segments",
        options: { none: Minus, upper: CaseUpper, lower: CaseLower, title: CaseSensitive, small: ALargeSmall },
      }),
    ],
    [placed("fill", hidden, { options: fills })],
  ],
  box: [
    [
      placed("align", hidden, {
        kind: "action",
        options: {
          left: AlignLeftEdge,
          center: AlignHorizontalCenter,
          right: AlignRightEdge,
          top: AlignTopEdge,
          middle: AlignVerticalCenter,
          bottom: AlignBottomEdge,
        },
      }),
    ],
    [
      placed("distribute", hidden, {
        kind: "action",
        options: { horizontal: AlignHorizontalDistributeCenter, vertical: AlignVerticalDistributeCenter },
      }),
    ],
  ],
  fills: [[placed("paint", hidden, { options: fills })], [placed("paint.solid", hidden)]],
  alignment: [[placed("align", hidden), placed("distribute", hidden)]],
  pictureFill: [],
  textFill: [[placed("value", hidden, { options: fills })], [placed("value.solid", hidden)]],
  border: [
    [
      placed("border", hidden, {
        options: { none: fillIcons.none, solid: SolidBorder, dash: DashedBorder, dot: DottedBorder },
      }),
    ],
    [placed("color", above), placed("width", above)],
    [placed("route", above, { options: { straight: StraightLine, elbow: ElbowLine, curve: CurvedLine } })],
  ],
  shadow: [
    [
      placed("shadow", hidden, {
        options: {
          none: fillIcons.none,
          soft: SoftShadow,
          lifted: LiftedShadow,
          glow: GlowShadow,
        },
      }),
    ],
    [placed("opacity", above, { slider: true })],
  ],
  corners: [[placed("corners", { show: "beside" }, { kind: "corners" })]],
  opacity: [[placed("opacity", { show: "beside" })]],
  geometry: [[placed("preset", hidden, { kind: "preset" })], [placed("adjust", hidden)]],
  image: [
    [placed("mode")],
    [placed("color"), placed("weight", above, { glyph: Minus, steps: iconWeightSteps, unit: "" })],
    [placed("source")],
  ],
  templateStyle: [[placed("major", inside)], [placed("minor", inside)]],
}

function placement(trait: SectionName, field: string): Placed | undefined {
  return sectionStrips[trait].flat().find((place) => place.field === field)
}

function fallbackName(kind: ControlKind, field: string): NameLook {
  if (["length", "angle", "percent", "count", "text"].includes(kind)) return inside
  return kind === "record" && field.includes(".") ? hidden : above
}

export function resolveControl(control: Omit<PanelControl, "kind" | "look">): PanelControl {
  const place = placement(control.trait, control.field)
  const kind = place?.kind ?? controlOf(control.desc)
  if (kind === null) throw new Error("Unsupported authoring control")
  const options = place?.options ?? {}
  const choices = control.desc.kind === "choice" ? control.desc.options : []
  return {
    ...control,
    kind,
    look: {
      name: place?.name ?? fallbackName(kind, control.field),
      options,
      form: place?.form ?? choiceLayout(control.field, choices),
      ...(place?.glyph === undefined ? {} : { glyph: place.glyph }),
      ...(place?.unit === undefined ? {} : { unit: place.unit }),
      ...(place?.steps === undefined ? {} : { steps: place.steps }),
      ...(place?.slider === undefined ? {} : { slider: true }),
    },
  }
}

export function arrange(trait: SectionName, controls: readonly PanelControl[]): readonly (readonly PanelControl[])[] {
  const strips = sectionStrips[trait]
    .map((strip) => strip.flatMap((place) => controls.filter((control) => control.field === place.field)))
    .filter((strip) => strip.length > 0)
  const placed = new Set(strips.flat().map((control) => control.field))
  return [...strips, ...controls.filter((control) => !placed.has(control.field)).map((control) => [control])]
}

export function choiceLayout(field: string, options: readonly string[]): "segments" | "list" {
  return options.length > 4 || options.some((option) => optionWord(field, option).length > 12) ? "list" : "segments"
}

export const controlKinds = [
  "corners",
  "typography",
  "length",
  "angle",
  "percent",
  "count",
  "toggle",
  "choice",
  "action",
  "color",
  "record",
  "union",
  "list",
  "adjust",
  "text",
  "asset",
  "preset",
  "link",
] as const

export type ControlKind = (typeof controlKinds)[number]

export function controlOf(desc: Desc): ControlKind | null {
  switch (desc.kind) {
    case "number":
      if (desc.unit === "emu" || desc.unit === "hundredth-point") return "length"
      return desc.unit === "angle" ? "angle" : desc.unit === "fraction" ? "percent" : "count"
    case "flag":
    case "mark":
      return "toggle"
    case "words":
      return "text"
    case "choice":
      return "choice"
    case "color":
      return "color"
    case "record":
      return "record"
    case "union":
      return "union"
    case "list":
      return "list"
    case "named":
      return "adjust"
    case "asset":
      return "asset"
    case "link":
      return "link"
  }
}
