import { readAngle, readRotation } from "./angle.js"
import { arrowField, startArrowField } from "./agent-arrow.js"
import { type AgentEnd, endSchema, readEnd } from "./agent-end.js"
import { type AgentInsert, insertField } from "./agent-insert.js"
import { type AgentItem, itemSchema, readItem } from "./agent-item.js"
import { linkField } from "./agent-link.js"
import { limits } from "./limits.js"
import { type Field, choice, field, flag, number, string } from "./agent-fields.js"
import { type InnerLook, innerShadowFields } from "./agent-inner-shadow.js"
import { type SlideLook, slideLookFields } from "./agent-slide-look.js"
import { type NodeId, readNodeId } from "./ids.js"
import {
  type ColorVar,
  type EffectStyleName,
  type Hex,
  type Px,
  colorVars,
  effectStyleNames,
  px,
  readHex,
  size,
} from "./paint.js"
import {
  type Reader,
  accepting,
  agentColor,
  boolean,
  detailOf,
  finite,
  formed,
  forms,
  list,
  literal,
  matching,
  mismatch,
  object,
  pair,
  union,
  variant,
  words,
  wrongForm,
} from "./read-kit.js"
import { type Refusal, refuse } from "./refusal.js"
import { type TextStyleName, textStyleNames } from "./text.js"
import type { Arrow } from "./geometry.js"
import { shapeNames } from "./preset-geometry.js"
import { cropField } from "./agent-crop.js"
import type { CropSides } from "./picture-crop.js"

export const patternNames = ["kpi", "cards", "compare", "matrix", "timeline", "flow"] as const
export type PatternName = (typeof patternNames)[number]
export const addKinds = ["text", "shape", "line", "frame", "picture", "icon", "chart", ...patternNames] as const
export type AgentAdd = (typeof addKinds)[number]

export type AgentColor = ColorVar | `${ColorVar}${"+" | "-"}${number}` | Hex
export type AgentGradient = {
  readonly gradient: readonly AgentColor[]
  readonly angle?: number
  readonly radial?: boolean
}
export type AgentFill = AgentColor | "none" | { readonly image: string } | AgentGradient
export type AgentBox = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }
export type AgentChart = {
  readonly kind: "bar" | "column" | "line" | "pie" | "stacked"
  readonly categories: readonly string[]
  readonly series: readonly { readonly name: string; readonly values: readonly number[]; readonly color?: AgentColor }[]
  readonly labels?: boolean
}
export type AgentLook = {
  readonly fill?: AgentFill
  readonly stroke?: AgentColor | "none"
  readonly strokeWidth?: Px
  readonly color?: AgentColor
  readonly radius?: Px
  readonly effect?: EffectStyleName | "none"
  readonly effectOpacity?: number
  readonly link?: string | "none"
  readonly clip?: boolean
  readonly opacity?: number
  readonly text?: string
  readonly insert?: AgentInsert
  readonly textStyle?: TextStyleName
  readonly align?: "left" | "center" | "right" | "justify"
  readonly layout?: "row" | "column" | "none"
  readonly gap?: Px
  readonly padding?: Px
  readonly icon?: string
  readonly arrow?: boolean | Arrow
  readonly startArrow?: Arrow
  readonly from?: AgentEnd
  readonly to?: AgentEnd
  readonly route?: "straight" | "elbow" | "curve"
  readonly chart?: AgentChart
  readonly rows?: readonly (readonly string[])[]
  readonly items?: readonly AgentItem[]
  readonly axes?: readonly [string, string]
  readonly box?: AgentBox
  readonly name?: string
  readonly hidden?: boolean
  readonly locked?: boolean
  readonly size?: Px
  readonly font?: string
  readonly lineHeight?: number
  readonly letterSpacing?: Px
  readonly case?: "none" | "upper" | "lower" | "title"
  readonly underline?: boolean
  readonly strike?: boolean
  readonly dash?: "solid" | "dash" | "dot"
  readonly fit?: "fill" | "fit" | "crop" | "tile"
  readonly crop?: CropSides
  readonly shape?: string
  readonly rotation?: number
  readonly flip?: "none" | "h" | "v" | "hv"
  readonly notes?: string
} & SlideLook &
  InnerLook

export type DeckLook = {
  readonly name?: string
  readonly nameFollows?: boolean
  readonly colors?: { readonly [K in ColorVar]?: Hex }
  readonly fonts?: { readonly heading?: string; readonly body?: string }
}
export type SlideAdd = { readonly after?: NodeId }
export type SlideMove = { readonly slide: NodeId; readonly after: NodeId | null }
export type AgentChange =
  | ({ readonly op: "add"; readonly kind: AgentAdd; readonly slide: NodeId; readonly into?: NodeId } & AgentLook)
  | ({ readonly op: "set"; readonly target: string } & AgentLook)
  | { readonly op: "move"; readonly node: NodeId; readonly into?: NodeId; readonly after?: NodeId | null }
  | {
      readonly op: "wrap"
      readonly nodes: readonly NodeId[]
      readonly layout?: "row" | "column" | "none"
      readonly clip?: boolean
    }
  | { readonly op: "unwrap"; readonly node: NodeId }
  | { readonly op: "delete"; readonly nodes: readonly NodeId[] }
  | { readonly op: "duplicate"; readonly nodes: readonly NodeId[] }
  | ({ readonly op: "deck" } & DeckLook)
  | {
      readonly op: "slide"
      readonly add?: SlideAdd
      readonly move?: SlideMove
      readonly delete?: NodeId
    }

export type AgentRefusal = Refusal & { readonly change: string; readonly at?: number; readonly field?: string }

const idSchema = { $ref: "#/$defs/id" }
const kindWords =
  "text and shape hold words. line. frame groups children, or rows makes a grid. picture: fill {image}. icon. chart. kpi: title, value, note. cards: title, points, icon. compare: 2 or 3 of title, points. matrix: up to 4, axes. timeline: 2 to 8 of value, title, note. flow: 2 to 6 of title, note."
const colorSchema = { $ref: "#/$defs/color" }
const readId = formed(readNodeId, forms.node)
const tintedName = new RegExp(`^(${colorVars.join("|")})([+-](100|[1-9][0-9]?))?$`)
export const readColor = agentColor(tintedName, 16, forms.color) as Reader<AgentColor>
const id = (description: string) => field<NodeId>({ ...idSchema, description }, readId)

const readNone = literal(["none"] as const)

const chartSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "categories", "series"],
  properties: {
    kind: { enum: ["bar", "column", "line", "pie", "stacked"] },
    categories: { type: "array", items: { type: "string" } },
    series: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "values"],
        properties: {
          name: { type: "string" },
          values: { type: "array", items: { type: "number" }, description: "One per category." },
          color: colorSchema,
        },
      },
    },
    labels: { type: "boolean", description: "Print each value on its bar." },
  },
}
const readChart: Reader<AgentChart> = (raw) => {
  const chart = object(
    {
      kind: literal(["bar", "column", "line", "pie", "stacked"] as const),
      categories: list(words(200), 200, 1),
      series: list(object({ name: words(200), values: list(finite(-1e12, 1e12), 200) }, { color: readColor }), 20, 1),
    },
    { labels: boolean },
  )(raw)
  return chart.series.every((series) => series.values.length === chart.categories.length)
    ? chart
    : mismatch("series", forms.series)
}

const readFontName = matching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,99}$/, 100, forms.font)
const readIconName = matching(/^([a-z0-9-]+\/)?[a-z0-9-]+$/, 80, forms.icon)
const readAfter = accepting(forms.after, (raw) => (raw === null ? null : readId(raw)))

type LookFields = { readonly [K in keyof AgentLook]-?: Field<Exclude<AgentLook[K], undefined>> }

const lookFields: LookFields = {
  fill: field(
    {
      description:
        "Paint inside the layer: a colour, none, {image} for a picture, or {gradient} through two to eight colours. Text takes color instead.",
      anyOf: [
        colorSchema,
        { const: "none" },
        {
          type: "object",
          additionalProperties: false,
          required: ["image"],
          properties: { image: { type: "string", description: "An https address, or an asset read from the deck." } },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["gradient"],
          properties: {
            gradient: { type: "array", items: colorSchema, minItems: 2, maxItems: 8 },
            angle: { type: "number", description: "Degrees; 0 runs left to right. Wraps past a full turn." },
            radial: { type: "boolean" },
          },
        },
      ],
    },
    union<AgentFill>(forms.fill, [
      readColor,
      readNone,
      object({ image: words(limits.address, 1) }),
      object({ gradient: list(readColor, 8, 2) }, { angle: readAngle, radial: boolean }),
    ]),
  ),
  stroke: field(
    { description: "Outline colour, or none.", anyOf: [colorSchema, { const: "none" }] },
    union(forms.stroke, [readColor, readNone]),
  ),
  strokeWidth: number(0, 200, "Outline weight in pixels. A stroke colour alone draws a thin one."),
  color: field({ ...colorSchema, description: "Text colour." }, readColor),
  radius: number(0, 10_000, "Corner radius in pixels. Half the shorter side or more makes a pill or a circle."),
  effect: choice<EffectStyleName | "none">(
    [...effectStyleNames, "none"],
    "A shadow or glow style from the deck, or none.",
  ),
  effectOpacity: number(0, 1, "Shadow strength, 0 to 1."),
  link: linkField,
  clip: flag("Clip a frame's children."),
  opacity: number(0, 1, "0 is clear, 1 is solid."),
  text: string(
    limits.valueBytes,
    "Words as markdown: **bold**, *italic*, ++underline++, ~~strike~~, [label](url), '- ' bullets, '1. ' numbers, two spaces for each level, a blank line between paragraphs. Replaces all the words.",
  ),
  insert: insertField,
  textStyle: choice(
    textStyleNames,
    "A named style from the deck: size, font, weight and spacing together. It clears size, font, lineHeight, letterSpacing and case. The first title text on a slide becomes its title.",
  ),
  align: choice(
    ["left", "center", "right", "justify"],
    "Text alignment. In a frame with a layout: where its children sit across the layout.",
  ),
  layout: choice(["row", "column", "none"], "How a frame places its children. none leaves them where they are."),
  gap: number(0, 1_000, "Space between the children of a row or column."),
  padding: number(0, 1_000, "Space between a frame's edge and its children."),
  icon: field({ type: "string", description: "An icon name such as star, arrow-right or trending-up." }, readIconName),
  arrow: arrowField,
  startArrow: startArrowField,
  from: field(endSchema("Where a line starts: a layer's side, which it then follows, or a point."), readEnd),
  to: field(endSchema("Where a line ends: a layer's side, which it then follows, or a point."), readEnd),
  route: choice(["straight", "elbow", "curve"], "How a line runs between its ends."),
  chart: field(
    {
      ...chartSchema,
      description:
        "Data for a chart. Axes, gridlines and legend come from the deck. Colour one bar later with set on '<chart>#<series>:<category>'.",
    },
    readChart,
  ),
  rows: field(
    {
      type: "array",
      items: { type: "array", items: { type: "string" } },
      description:
        "Add with kind frame. Words in a grid, one array for each row, the first row the header. Markdown works in a cell. An empty string leaves the cell empty.",
    },
    list(list(words(limits.valueBytes), 24, 1), 64, 1),
  ),
  items: field(
    {
      type: "array",
      items: itemSchema,
      description:
        "What a pattern shows. kpi: title, value, note. cards: title, points, icon. compare: title, points. matrix: title, points, in reading order. timeline: value, title, note. flow: title, note.",
    },
    list(readItem, 8, 1),
  ),
  axes: field(
    {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 2,
      description: "Matrix axis labels: across, then up.",
    },
    pair(words(100)),
  ),
  box: field(
    {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "w", "h"],
      properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
      description:
        "x, y, w, h in pixels on the slide, or inside the frame you add into. Left out: the largest free area.",
    },
    object({ x: px(), y: px(), w: size, h: size }),
  ),
  name: field<string>(
    { type: "string", description: "Layer name, or with op deck the deck's name. Never empty." },
    (raw) => {
      const name = words(limits.name, 1)(raw)
      return name.trim() === "" ? wrongForm(forms.text) : name
    },
  ),
  hidden: flag("Hide the layer."),
  locked: flag("Lock the layer against selection and moves."),
  size: number(1, 2_000, "Text size in pixels."),
  font: field({ type: "string", description: "A font family, such as Inter." }, readFontName),
  lineHeight: number(0.5, 5, "Line height as a multiple of the size."),
  letterSpacing: number(-100, 100, "Letter spacing in pixels."),
  case: choice(["none", "upper", "lower", "title"], "Letter case."),
  underline: flag("Underline all the words."),
  strike: flag("Strike through all the words."),
  dash: choice(["solid", "dash", "dot"], "Outline dash."),
  fit: choice(["fill", "fit", "crop", "tile"], "How a picture sits in its layer."),
  crop: cropField,
  shape: choice(shapeNames, "A shape's outline. Lines and connectors are not shapes: add kind line."),
  rotation: field<number>({ type: "number", description: "Degrees clockwise. Wraps past a full turn." }, readRotation),
  flip: choice(["none", "h", "v", "hv"], "Mirror across, down, or both."),
  notes: field({ type: "string", description: "Presenter notes." }, words(limits.valueBytes)),
  ...slideLookFields,
  ...innerShadowFields(readColor),
}

const lookKeys = Object.keys(lookFields) as (keyof AgentLook)[]

const readSlideAdd = object({}, { after: readId })
const readSlideMove = object({ slide: readId, after: readAfter })
const readTarget = matching(
  /^([a-z0-9]{1,16}:[0-9]{1,12}(\.(title|subtitle|body)|#.{3,240})?|\*\.(title|subtitle|body))$/,
  280,
  forms.target,
)

const placeFields = {
  kind: choice(addKinds, kindWords),
  slide: id("The slide to add to."),
  into: id("A frame on that slide to add into."),
  target: field(
    {
      type: "string",
      description:
        "A node id; '<slide>.title', '<slide>.subtitle' or '<slide>.body', the node with that role; '*.title' and the like, that role on every slide; or a chart bar '<chart>#<series>:<category>', which takes only fill.",
    },
    readTarget,
  ),
  node: id("The node."),
  nodes: field(
    { type: "array", items: idSchema, minItems: 1, maxItems: limits.delete, description: "Node ids." },
    list(readId, limits.delete, 1),
  ),
  after: field(
    {
      oneOf: [idSchema, { type: "null" }],
      description: "Place after this sibling. null puts it first. Left out puts it last.",
    },
    readAfter,
  ),
  add: field(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        after: { ...idSchema, description: "The slide to add after. Left out: at the end." },
      },
      description: "Add a slide.",
    },
    readSlideAdd,
  ),
  move: field(
    {
      type: "object",
      additionalProperties: false,
      required: ["slide", "after"],
      properties: { slide: idSchema, after: { oneOf: [idSchema, { type: "null" }] } },
      description: "Move a slide after another slide, or to the front with null.",
    },
    readSlideMove,
  ),
  delete: id("A slide to delete."),
  colors: field(
    {
      type: "object",
      additionalProperties: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      description: "Theme colours by name, as #rrggbb. Every layer that names one follows.",
    },
    object({}, Object.fromEntries(colorVars.map((name) => [name, readHex])) as Record<ColorVar, Reader<Hex>>),
  ),
  fonts: field(
    {
      type: "object",
      additionalProperties: false,
      properties: { heading: { type: "string" }, body: { type: "string" } },
      description: "The theme's heading and body font families.",
    },
    object({}, { heading: readFontName, body: readFontName }),
  ),
  nameFollows: flag("true: the deck's name follows slide 1's title. Setting a name stops it."),
} as const

const pickFrom = <T extends { readonly [P in keyof T]: Field<unknown> }, K extends keyof T>(
  source: T,
  keys: readonly K[],
) =>
  Object.fromEntries(keys.map((key) => [key, source[key].read])) as {
    [P in K]: T[P] extends Field<infer V> ? Reader<V> : never
  }

const lookReaders = pickFrom(lookFields, lookKeys)

const readChange = variant("op", {
  add: object(pickFrom(placeFields, ["kind", "slide"]), { ...pickFrom(placeFields, ["into"]), ...lookReaders }),
  set: object(pickFrom(placeFields, ["target"]), lookReaders),
  move: object(pickFrom(placeFields, ["node"]), pickFrom(placeFields, ["into", "after"])),
  wrap: object(pickFrom(placeFields, ["nodes"]), pickFrom(lookFields, ["layout", "clip"])),
  unwrap: object(pickFrom(placeFields, ["node"])),
  delete: object(pickFrom(placeFields, ["nodes"])),
  slide: object({}, pickFrom(placeFields, ["add", "move", "delete"])),
  duplicate: object(pickFrom(placeFields, ["nodes"])),
  deck: object({}, { ...pickFrom(lookFields, ["name"]), ...pickFrom(placeFields, ["colors", "fonts", "nameFollows"]) }),
})

export function readAgentChange(raw: unknown): AgentChange | (Refusal & { readonly field?: string }) {
  try {
    return readChange(raw) as AgentChange
  } catch (thrown) {
    return detailOf(thrown)
  }
}

export function readAgentChanges(raw: unknown): readonly AgentChange[] | Refusal {
  if (!Array.isArray(raw) || raw.length === 0) return refuse("shape")
  if (raw.length > limits.batch) return refuse("limit")
  const changes: AgentChange[] = []
  for (const each of raw) {
    const change = readAgentChange(each)
    if ("refused" in change) return change
    changes.push(change)
  }
  return changes
}

const schemasOf = (source: Readonly<Record<string, Field<unknown>>>) =>
  Object.fromEntries(Object.entries(source).map(([key, each]) => [key, each.schema]))

export const agentChangesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      minItems: 1,
      maxItems: limits.batch,
      items: { $ref: "#/$defs/change" },
      description:
        "Applied in order, all or none. Sizes are pixels on a 1920 by 1080 slide. Take ids from read_deck; a layer you add has an id only in the answer. Patterns and frames with a layout place their own children. Colours are theme names, so a new template recolours the deck.",
    },
  },
  $defs: {
    id: { type: "string", pattern: "^[a-z0-9]{1,16}:[0-9]{1,12}$" },
    color: {
      type: "string",
      pattern: "^((text|background|text2|background2|accent[1-6]|link)([+-][0-9]{1,3})?|#[0-9a-fA-F]{6})$",
      description:
        "A theme colour name, lighter or darker by a percent (accent1+40, text-20), or #rrggbb. Prefer names: a template recolours them.",
    },
    change: {
      type: "object",
      additionalProperties: false,
      required: ["op"],
      properties: {
        op: {
          enum: ["add", "set", "move", "wrap", "unwrap", "delete", "slide", "duplicate", "deck"],
          description:
            "add: kind, slide, into?, look. set: target, look. move: node, into?, after?. wrap: nodes, layout?. unwrap: node. delete: nodes. slide: one of add, move, delete. duplicate: nodes, layers or slides, each copied right after itself. deck: name?, nameFollows?, colors?, fonts?.",
        },
        ...schemasOf(placeFields),
        ...schemasOf(lookFields),
      },
    },
  },
} as const
