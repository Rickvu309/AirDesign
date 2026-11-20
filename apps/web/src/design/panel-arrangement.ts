import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Minus,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react"
import {
  SolidBorder,
  DashedBorder,
  DottedBorder,
  SubtleShadow,
  MediumShadow,
  StrongShadow,
  fillIcons,
  AlignLeftEdge,
  AlignHorizontalCenter,
  AlignRightEdge,
  AlignTopEdge,
  AlignVerticalCenter,
  AlignBottomEdge,
} from "./preset-icons"
import { LineHeightIcon, LetterSpacingIcon } from "./text-icons"
import {
  BottomPadding,
  HorizontalFlow,
  HorizontalGap,
  HorizontalLayoutAlignment,
  HorizontalPadding,
  LeftPadding,
  RightPadding,
  TopPadding,
  VerticalFlow,
  VerticalGap,
  VerticalLayoutAlignment,
  VerticalPadding,
} from "./layout-icons"
import { optionWord } from "@/copy/option-copy"
import type { Desc } from "@airdesign/document"
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
  readonly unnamed?: boolean
  readonly unit?: string
}

type Placed = {
  readonly field: string
  readonly name: NameLook
  readonly control?: "canvas"
  readonly kind?: ControlKind
  readonly options?: Readonly<Record<string, LucideIcon>>
  readonly form?: "segments" | "list" | "grid"
  readonly unit?: string
  readonly glyph?: LucideIcon
  readonly steps?: readonly number[]
  readonly slider?: boolean
  readonly unnamed?: boolean
}

type Strip = readonly Placed[]
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
const letter = (field: string, text: string): Placed => placed(field, { show: "letter", letter: text })

const paragraphSpacing = [icon("spaceBefore", ArrowUpToLine), icon("spaceAfter", ArrowDownToLine)]

export const sectionStrips: Readonly<Record<SectionName, readonly Strip[]>> = {
  layout: [
    [placed("flow", above, { options: { vertical: VerticalFlow, horizontal: HorizontalFlow } })],
    [
      placed("align", above, { form: "grid", glyph: HorizontalLayoutAlignment }),
      placed("gap", above, { glyph: HorizontalGap, unit: "" }),
    ],
    [placed("padding")],
    [
      placed("padding.horizontal", { show: "icon", icon: HorizontalPadding }, { unit: "" }),
      placed("padding.vertical", { show: "icon", icon: VerticalPadding }, { unit: "" }),
    ],
    [
      placed("padding.left", { show: "icon", icon: LeftPadding }, { unit: "" }),
      placed("padding.top", { show: "icon", icon: TopPadding }, { unit: "" }),
    ],
    [
      placed("padding.right", { show: "icon", icon: RightPadding }, { unit: "" }),
      placed("padding.bottom", { show: "icon", icon: BottomPadding }, { unit: "" }),
    ],
  ],
  show: [[placed("skipped", hidden, { control: "canvas" })]],
  transition: [[{ field: "value", name: hidden }]],
  guides: [[{ field: "ruler", name: hidden }], [{ field: "layout", name: hidden }]],
  link: [[placed("target", hidden)]],
  text: [
    [placed("value", hidden, { control: "canvas" })],
    [placed("style", hidden)],
    [placed("font", hidden)],
    [placed("weight", above, { form: "list" }), placed("size", above)],
    [icon("lineHeight", LineHeightIcon), icon("letterSpacing", LetterSpacingIcon)],
    [icon("bold", Bold), icon("italic", Italic), icon("underline", Underline), icon("strike", Strikethrough)],
    [
      placed("align", hidden, {
        form: "segments",
        options: { left: AlignLeft, center: AlignCenter, right: AlignRight },
      }),
      placed("list", hidden, { form: "segments", options: { none: Minus, bullets: List, numbers: ListOrdered } }),
    ],
    [placed("fill", hidden, { options: fills })],
    [placed("color", hidden, { control: "canvas" })],
    paragraphSpacing,
  ],
  paragraphSpacing: [paragraphSpacing],
  box: [
    [letter("x", "X"), letter("y", "Y")],
    [letter("w", "W"), letter("h", "H")],
    [icon("rot", RotateCw), icon("flipH", FlipHorizontal2), icon("flipV", FlipVertical2)],
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
  fills: [
    [placed("paint", hidden, { options: fills })],
    [placed("paint.solid", hidden)],
    [placed("add", hidden, { kind: "action" })],
  ],
  alignment: [[placed("align", hidden), placed("distribute", hidden)]],
  pictureFill: [],
  textFill: [[placed("value", hidden, { options: fills })], [placed("value.solid", hidden)]],
  boxFill: [[placed("paint", hidden, { options: fills })], [placed("paint.solid", hidden)]],
  fillDetails: [],
  border: [
    [
      placed("border", hidden, {
        options: { none: fillIcons.none, solid: SolidBorder, dash: DashedBorder, dot: DottedBorder },
      }),
    ],
    [placed("fill", above, { options: fills, form: "list" })],
    [placed("fill.solid", hidden)],
    [placed("color", above), placed("width", above)],
    [placed("dash", above, { form: "list" })],
    [placed("cap", above, { form: "list" }), placed("compound", above, { form: "list" })],
    [placed("join", above, { form: "list" })],
    [placed("head"), placed("tail")],
    [placed("head.type", above, { form: "list" })],
    [placed("head.width", above, { form: "list" })],
    [placed("head.length", above, { form: "list" })],
    [placed("tail.type", above, { form: "list" })],
    [placed("tail.width", above, { form: "list" })],
    [placed("tail.length", above, { form: "list" })],
  ],
  shadow: [
    [
      placed("shadow", hidden, {
        options: {
          none: fillIcons.none,
          subtle: SubtleShadow,
          medium: MediumShadow,
          strong: StrongShadow,
        },
        unnamed: true,
      }),
    ],
    [placed("opacity", above, { slider: true })],
  ],
  corners: [[placed("corners", { show: "beside" }, { kind: "corners" })]],
  opacity: [[placed("opacity", { show: "beside" })]],
  identity: [
    [placed("name", inside)],
    [placed("alt", inside)],
    [placed("hidden")],
    [placed("locked")],
    [placed("mask")],
  ],
  geometry: [
    [placed("shape", hidden)],
    [placed("shape.preset", above, { kind: "preset" })],
    [placed("shape.adjust", hidden)],
  ],
  effects: [
    [placed("shadow")],
    [placed("innerShadow")],
    [placed("glow")],
    [placed("softEdge")],
    [placed("blur")],
    [placed("shadow.outer", hidden)],
    [placed("shadow.outer.blur", inside), placed("shadow.outer.distance", inside)],
    [placed("shadow.outer.direction", inside)],
    [placed("shadow.outer.color")],
    [placed("glow.halo", hidden)],
    [placed("glow.halo.radius", inside)],
    [placed("glow.halo.color")],
    [placed("softEdge.radius", inside)],
    [placed("blur.radius", inside)],
    [placed("innerShadow.inner", hidden)],
    [placed("innerShadow.inner.blur", inside), placed("innerShadow.inner.distance", inside)],
    [placed("innerShadow.inner.direction", inside)],
    [placed("innerShadow.inner.color")],
    [placed("add", hidden, { kind: "action" })],
  ],
  body: [
    [placed("insets")],
    [placed("anchor")],
    [placed("wrap")],
    [placed("autofit")],
    [placed("vertical")],
    [placed("columns", inside)],
    [placed("insets.left", inside), placed("insets.top", inside)],
    [placed("insets.right", inside), placed("insets.bottom", inside)],
  ],
  image: [
    [placed("mode")],
    [placed("tileScale")],
    [placed("overlay"), placed("blur")],
    [placed("source")],
    [placed("recolor")],
  ],
  crop: [
    [placed("rect", hidden)],
    [placed("rect.l", inside), placed("rect.t", inside)],
    [placed("rect.r", inside), placed("rect.b", inside)],
  ],
  connection: [
    [placed("start")],
    [placed("end")],
    [placed("start.shape", hidden)],
    [placed("start.shape.node")],
    [placed("start.shape.site", above, { kind: "site" })],
    [placed("end.shape", hidden)],
    [placed("end.shape.node")],
    [placed("end.shape.site", above, { kind: "site" })],
  ],
  table: [[placed("value")]],
  notes: [[placed("value", hidden)]],
  templateStyle: [
    [{ field: "id", name: { show: "hidden" } }],
    [placed("name", inside)],
    [placed("dk1", hidden), placed("lt1", hidden)],
    [placed("dk2", hidden), placed("lt2", hidden)],
    [placed("accent1", hidden), placed("accent2", hidden)],
    [placed("accent3", hidden), placed("accent4", hidden)],
    [placed("accent5", hidden), placed("accent6", hidden)],
    [placed("hlink", hidden), placed("folHlink", hidden)],
    [placed("major", inside)],
    [placed("minor", inside)],
    [placed("custom", hidden)],
    [placed("removed", hidden)],
    [placed("textStyle", hidden)],
  ],
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
      ...(place?.unnamed === undefined ? {} : { unnamed: true }),
    },
  }
}

export function canvasControl(trait: SectionName, field: string): boolean {
  return placement(trait, field)?.control === "canvas"
}

export function arrange(trait: SectionName, controls: readonly PanelControl[]): readonly (readonly PanelControl[])[] {
  const vertical =
    trait === "layout" && controls.some((control) => control.field === "flow" && control.value === "vertical")
  const strips = sectionStrips[trait]
    .map((strip) => strip.flatMap((place) => controls.filter((control) => control.field === place.field)))
    .filter((strip) => strip.length > 0)
  const placed = new Set(strips.flat().map((control) => control.field))
  const rows = [...strips, ...fallbackStrips(controls.filter((control) => !placed.has(control.field)))]
  if (!vertical) return rows
  return rows.map((row) =>
    row.map((control) => {
      const glyph =
        control.field === "align" ? VerticalLayoutAlignment : control.field === "gap" ? VerticalGap : undefined
      return glyph === undefined ? control : { ...control, look: { ...control.look, glyph } }
    }),
  )
}

function fallbackStrips(controls: readonly PanelControl[]): readonly (readonly PanelControl[])[] {
  return controls.map((control) => [control])
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
  "hex",
  "record",
  "union",
  "list",
  "adjust",
  "text",
  "asset",
  "node",
  "site",
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
    case "text":
      return "text"
    case "choice":
      return "choice"
    case "color":
      return "color"
    case "hex":
      return "hex"
    case "alpha":
      return "percent"
    case "record":
      return "record"
    case "union":
      return "union"
    case "list":
      return "list"
    case "named":
      return "adjust"
    case "table":
      return null
    case "asset":
      return "asset"
    case "link":
      return "link"
    case "node":
      return "node"
  }
}
