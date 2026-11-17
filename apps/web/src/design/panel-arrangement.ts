import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  List,
  Underline,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Type,
  ArrowDownUp,
  ArrowUpToLine,
  ArrowDownToLine,
  Image,
  Minus,
  Square,
  SquareDashed,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react"
import {
  DottedBorder,
  SubtleShadow,
  MediumShadow,
  StrongShadow,
  PatternFill,
  SolidFill,
  GradientFill,
  AlignLeftEdge,
  AlignHorizontalCenter,
  AlignRightEdge,
  AlignTopEdge,
  AlignVerticalCenter,
  AlignBottomEdge,
} from "./preset-icons"
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
  readonly form: "segments" | "list"
}

type Placed = {
  readonly field: string
  readonly name: NameLook
  readonly control?: "canvas"
  readonly kind?: ControlKind
  readonly options?: Readonly<Record<string, LucideIcon>>
  readonly form?: "segments" | "list"
}

type Strip = readonly Placed[]
const above: NameLook = { show: "above" }
const hidden: NameLook = { show: "hidden" }
const inside: NameLook = { show: "inside" }
const fills = { none: Minus, solid: SolidFill, gradient: GradientFill, pattern: PatternFill, picture: Image }
const placed = (field: string, name: NameLook = above, rest: Omit<Placed, "field" | "name"> = {}): Placed => ({
  field,
  name,
  ...rest,
})
const icon = (field: string, glyph: LucideIcon): Placed => placed(field, { show: "icon", icon: glyph })
const letter = (field: string, text: string): Placed => placed(field, { show: "letter", letter: text })

export const sectionStrips: Readonly<Record<SectionName, readonly Strip[]>> = {
  link: [[placed("target", hidden)]],
  text: [
    [placed("value", hidden, { control: "canvas" })],
    [placed("font", hidden)],
    [icon("size", Type), icon("lineSpacing", ArrowDownUp)],
    [icon("bold", Bold), icon("italic", Italic), icon("underline", Underline)],
    [
      placed("align", hidden, {
        form: "segments",
        options: { left: AlignLeft, center: AlignCenter, right: AlignRight },
      }),
      placed("bullet", hidden, { options: { true: List } }),
    ],
    [placed("color", hidden)],
    [icon("spaceBefore", ArrowUpToLine), icon("spaceAfter", ArrowDownToLine)],
  ],
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
  fill: [[placed("value", hidden, { options: fills })], [placed("value.solid", hidden)]],
  line: [
    [placed("fill", hidden, { options: fills })],
    [placed("width", above), placed("dash", above, { form: "list" })],
    [placed("cap", above, { form: "list" }), placed("compound", above, { form: "list" })],
    [placed("join", above, { form: "list" })],
    [placed("head"), placed("tail")],
    [placed("fill.solid", hidden)],
    [placed("head.type", above, { form: "list" })],
    [placed("head.width", above, { form: "list" })],
    [placed("head.length", above, { form: "list" })],
    [placed("tail.type", above, { form: "list" })],
    [placed("tail.width", above, { form: "list" })],
    [placed("tail.length", above, { form: "list" })],
  ],
  alignment: [[placed("align", hidden), placed("distribute", hidden)]],
  pictureFill: [],
  border: [
    [
      placed("border", hidden, {
        options: { none: Minus, solid: Square, dash: SquareDashed, dot: DottedBorder },
      }),
    ],
    [placed("fill.solid", above), placed("width", above)],
  ],
  shadow: [
    [
      placed("shadow", hidden, {
        options: {
          none: Minus,
          subtle: SubtleShadow,
          medium: MediumShadow,
          strong: StrongShadow,
          PatternFill,
          SolidFill,
          GradientFill,
          AlignLeftEdge,
          AlignHorizontalCenter,
          AlignRightEdge,
          AlignTopEdge,
          AlignVerticalCenter,
          AlignBottomEdge,
        },
      }),
    ],
  ],
  corners: [[placed("corners", { show: "beside" }, { kind: "corners" })]],
  opacity: [[placed("opacity", { show: "beside" })]],
  identity: [[placed("name", inside)], [placed("alt", inside)], [placed("hidden")]],
  geometry: [
    [placed("shape", hidden)],
    [placed("shape.preset", above, { kind: "preset" })],
    [placed("shape.adjust", hidden)],
  ],
  effects: [
    [placed("shadow")],
    [placed("glow")],
    [placed("softEdge")],
    [placed("shadow.outer", hidden)],
    [placed("shadow.outer.blur", inside), placed("shadow.outer.distance", inside)],
    [placed("shadow.outer.direction", inside)],
    [placed("shadow.outer.color")],
    [placed("glow.halo", hidden)],
    [placed("glow.halo.radius", inside)],
    [placed("glow.halo.color")],
    [placed("softEdge.radius", inside)],
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
  image: [[placed("mode")], [placed("source")], [placed("recolor")]],
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
  theme: [
    [placed("dk1", hidden), placed("lt1", hidden)],
    [placed("dk2", hidden), placed("lt2", hidden)],
    [placed("accent1", hidden), placed("accent2", hidden)],
    [placed("accent3", hidden), placed("accent4", hidden)],
    [placed("accent5", hidden), placed("accent6", hidden)],
    [placed("hlink", hidden), placed("folHlink", hidden)],
    [placed("major", inside)],
    [placed("minor", inside)],
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
    },
  }
}

export function canvasControl(trait: SectionName, field: string): boolean {
  return placement(trait, field)?.control === "canvas"
}

export function arrange(trait: SectionName, controls: readonly PanelControl[]): readonly (readonly PanelControl[])[] {
  const strips = sectionStrips[trait]
    .map((strip) => strip.flatMap((place) => controls.filter((control) => control.field === place.field)))
    .filter((strip) => strip.length > 0)
  const placed = new Set(strips.flat().map((control) => control.field))
  return [...strips, ...fallbackStrips(controls.filter((control) => !placed.has(control.field)))]
}

function fallbackStrips(controls: readonly PanelControl[]): readonly (readonly PanelControl[])[] {
  return controls.map((control) => [control])
}

export function choiceLayout(field: string, options: readonly string[]): "segments" | "list" {
  return options.length > 4 || options.some((option) => optionWord(field, option).length > 12) ? "list" : "segments"
}

export const controlKinds = [
  "corners",
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
