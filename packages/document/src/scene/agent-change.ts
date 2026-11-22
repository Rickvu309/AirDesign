import { limits } from "../limits.js"
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
  boolean,
  finite,
  list,
  literal,
  matching,
  object,
  oneOf,
  pair,
  reject,
  rejected,
  variant,
  words,
} from "./read-kit.js"
import { type Refusal, refuse } from "./refusal.js"
import { type TextStyleName, textStyleNames } from "./text.js"

export const patternNames = ["kpi", "cards", "compare", "matrix", "timeline", "flow"] as const
export type PatternName = (typeof patternNames)[number]
export const addKinds = ["text", "shape", "line", "frame", "picture", "icon", "chart", ...patternNames] as const
export type AgentAdd = (typeof addKinds)[number]

export type AgentColor = ColorVar | Hex
export type AgentFill = AgentColor | "none" | { readonly image: string }
export type AgentBox = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }
export type AgentItem = {
  readonly title?: string
  readonly value?: string
  readonly note?: string
  readonly points?: readonly string[]
  readonly icon?: string
}
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
  readonly opacity?: number
  readonly text?: string
  readonly textStyle?: TextStyleName
  readonly align?: "left" | "center" | "right"
  readonly layout?: "row" | "column" | "none"
  readonly gap?: Px
  readonly padding?: Px
  readonly icon?: string
  readonly arrow?: boolean
  readonly chart?: AgentChart
  readonly rows?: readonly (readonly string[])[]
  readonly items?: readonly AgentItem[]
  readonly axes?: readonly [string, string]
  readonly box?: AgentBox
  readonly name?: string
  readonly hidden?: boolean
}
export type SlideAdd = { readonly layout?: string; readonly after?: NodeId }
export type SlideMove = { readonly slide: NodeId; readonly after: NodeId | null }
export type AgentChange =
  | ({ readonly op: "add"; readonly kind: AgentAdd; readonly slide: NodeId; readonly into?: NodeId } & AgentLook)
  | ({ readonly op: "set"; readonly target: string } & AgentLook)
  | { readonly op: "move"; readonly node: NodeId; readonly into?: NodeId; readonly after?: NodeId | null }
  | { readonly op: "wrap"; readonly nodes: readonly NodeId[]; readonly layout?: "row" | "column" | "none" }
  | { readonly op: "unwrap"; readonly node: NodeId }
  | { readonly op: "delete"; readonly nodes: readonly NodeId[] }
  | {
      readonly op: "slide"
      readonly add?: SlideAdd
      readonly move?: SlideMove
      readonly delete?: NodeId
    }

export type AgentRefusal = Refusal & { readonly change: string; readonly at?: number; readonly field?: string }

type JsonSchema = Readonly<Record<string, unknown>>
type Field<T> = { readonly schema: JsonSchema; readonly read: Reader<T> }
const field = <T>(schema: JsonSchema, read: Reader<T>): Field<T> => ({ schema, read })

const idSchema = { $ref: "#/$defs/id" }
const kindWords =
  "text and shape hold words. line. frame groups and lays out its children, or with rows is a grid of words. picture (fill: {image}). icon (icon). chart (chart). Patterns: kpi (items: title, value, note), cards (title, points, icon), compare (2 or 3 items: title, points), matrix (up to 4 items, axes), timeline (2 to 8: value, title, note), flow (2 to 6: title, note)."
const colorSchema = { $ref: "#/$defs/color" }
const readId: Reader<NodeId> = (raw) => readNodeId(raw) ?? reject()
const readColor: Reader<AgentColor> = oneOf<AgentColor>(literal(colorVars), readHex)
const id = (description: string) => field<NodeId>({ ...idSchema, description }, readId)
const choice = <const V extends string>(values: readonly V[], description?: string) =>
  field<V>({ enum: values, ...(description === undefined ? {} : { description }) }, literal(values))
const number = (min: number, max: number, description: string) =>
  field<number>({ type: "number", minimum: min, maximum: max, description }, finite(min, max))
const flag = (description: string) => field<boolean>({ type: "boolean", description }, boolean)
const string = (maxBytes: number, description: string) =>
  field<string>({ type: "string", description }, words(maxBytes, 1))

const readNone = literal(["none"] as const)

const itemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    value: { type: "string", description: "A number or a date." },
    note: { type: "string" },
    points: { type: "array", items: { type: "string" }, description: "One bullet each." },
    icon: { type: "string", description: "An icon name." },
  },
}
const readItem = object(
  {},
  { title: words(300), value: words(100), note: words(500), points: list(words(500), 12), icon: words(80, 1) },
)

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
  return chart.series.every((series) => series.values.length === chart.categories.length) ? chart : reject()
}

const readIconName = matching(/^([a-z0-9-]+\/)?[a-z0-9-]+$/, 80)
const readAfter: Reader<NodeId | null> = (raw) => (raw === null ? null : readId(raw))

type LookFields = { readonly [K in keyof AgentLook]-?: Field<Exclude<AgentLook[K], undefined>> }

const lookFields: LookFields = {
  fill: field(
    {
      description: "Paint inside the layer: a colour, none, or {image} for a picture. Text takes color instead.",
      anyOf: [
        colorSchema,
        { const: "none" },
        {
          type: "object",
          additionalProperties: false,
          required: ["image"],
          properties: { image: { type: "string", description: "An https address, or an asset read from the deck." } },
        },
      ],
    },
    oneOf<AgentFill>(readColor, readNone, object({ image: words(limits.address, 1) })),
  ),
  stroke: field(
    { description: "Outline colour, or none.", anyOf: [colorSchema, { const: "none" }] },
    oneOf<AgentColor | "none">(readColor, readNone),
  ),
  strokeWidth: number(0, 200, "Outline weight in pixels. A stroke colour alone draws a thin one."),
  color: field({ ...colorSchema, description: "Text colour." }, readColor),
  radius: number(0, 10_000, "Corner radius in pixels. Half the shorter side or more makes a pill or a circle."),
  effect: choice<EffectStyleName | "none">(
    [...effectStyleNames, "none"],
    "A shadow or glow style from the deck, or none.",
  ),
  opacity: number(0, 1, "0 is clear, 1 is solid."),
  text: string(
    limits.valueBytes,
    "Words as markdown: **bold**, *italic*, [label](url), '- ' bullets, '1. ' numbers, two spaces for each level, a blank line between paragraphs. Replaces all the words in the layer.",
  ),
  textStyle: choice(
    textStyleNames,
    "A named size from the deck. You cannot set a size. The first title text on a slide becomes its title.",
  ),
  align: choice(
    ["left", "center", "right"],
    "Text alignment. In a frame with a layout: where its children sit across the layout.",
  ),
  layout: choice(["row", "column", "none"], "How a frame places its children. none leaves them where they are."),
  gap: number(0, 1_000, "Space between the children of a row or column."),
  padding: number(0, 1_000, "Space between a frame's edge and its children."),
  icon: field({ type: "string", description: "An icon name such as star, arrow-right or trending-up." }, readIconName),
  arrow: flag("Put an arrowhead at the end of a line."),
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
  name: string(limits.name, "Layer name."),
  hidden: flag("Hide the layer."),
}

const lookKeys = Object.keys(lookFields) as (keyof AgentLook)[]

const readSlideAdd = object({}, { layout: words(limits.name, 1), after: readId })
const readSlideMove = object({ slide: readId, after: readAfter })
const readTarget = matching(/^[a-z0-9]{1,16}:[0-9]{1,12}(\.(title|subtitle|body)|#.{3,240})?$/, 280)

const placeFields = {
  kind: choice(addKinds, kindWords),
  slide: id("The slide to add to."),
  into: id("A frame on that slide to add into."),
  target: field(
    {
      type: "string",
      description:
        "A node id; '<slide>.title', '<slide>.subtitle' or '<slide>.body', the node with that role; or a chart bar '<chart>#<series>:<category>', which takes only fill.",
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
        layout: {
          type: "string",
          description: "A layout name read_deck lists. The new slide starts with that layout's nodes.",
        },
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
  wrap: object(pickFrom(placeFields, ["nodes"]), pickFrom(lookFields, ["layout"])),
  unwrap: object(pickFrom(placeFields, ["node"])),
  delete: object(pickFrom(placeFields, ["nodes"])),
  slide: object({}, pickFrom(placeFields, ["add", "move", "delete"])),
})

export function readAgentChange(raw: unknown): AgentChange | Refusal {
  try {
    return readChange(raw) as AgentChange
  } catch (thrown) {
    return refuse(rejected(thrown))
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
      pattern: "^(text|background|text2|background2|accent[1-6]|link|#[0-9a-fA-F]{6})$",
      description: "A theme colour name or #rrggbb. Prefer names: a template recolours them.",
    },
    change: {
      type: "object",
      additionalProperties: false,
      required: ["op"],
      properties: {
        op: {
          enum: ["add", "set", "move", "wrap", "unwrap", "delete", "slide"],
          description:
            "add: kind, slide, into?, look. set: target, look. move: node, into?, after?. wrap: nodes, layout?. unwrap: node. delete: nodes. slide: one of add, move, delete.",
        },
        ...schemasOf(placeFields),
        ...schemasOf(lookFields),
      },
    },
  },
} as const
