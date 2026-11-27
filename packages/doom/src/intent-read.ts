import type { IntentBox, IntentColor, IntentFill, IntentLook } from "./intent-look-types.js"
import { languageField } from "./language.js"
import { readAngle, readRotation } from "./angle.js"
import { arrowField, startArrowField } from "./intent-arrow.js"
import { weightNames } from "./painted-face.js"
import { endSchema, readEnd } from "./intent-end.js"
import { insertField } from "./intent-insert.js"
import { linkField } from "./intent-link.js"
import { limits } from "./limits.js"
import { type Field, choice, field, flag, number, string } from "./intent-fields.js"
import { innerShadowFields } from "./intent-inner-shadow.js"
import { slideLookFields } from "./intent-slide-look.js"
import { idSchema, readAfter, readGroup, readId } from "./intent-ids.js"
import { type LayerKind, type NodeKind, layerKinds, nodeKinds } from "./kind-fields.js"
import type { NodeId } from "./ids.js"
import type { TreeNode } from "./doom-tree.js"
import {
  type ColorVar,
  type EffectStyleName,
  type Hex,
  type Px,
  type Sides,
  colorVars,
  effectStyleNames,
  px,
  readHex,
  size,
} from "./paint.js"
import {
  type Reader,
  colorMatching,
  boolean,
  detailOf,
  finite,
  list,
  literal,
  matching,
  object,
  union,
  variant,
  words,
  wrongForm,
} from "./read-kit.js"
import type { Refusal } from "./refusal.js"
import { textStyleNames } from "./text.js"
import { type Theme, readTheme } from "./theme.js"
import { pathLimit, readPathData } from "./geometry.js"
import { shapeNames } from "./preset-geometry.js"
import { cropField } from "./intent-crop.js"

export type { IntentBox, IntentColor, IntentFill, IntentGradient, IntentLook } from "./intent-look-types.js"

export type DeckLook = {
  readonly name?: string
  readonly nameFollows?: boolean
  readonly language?: string
  readonly theme?: Theme
  readonly colors?: { readonly [K in ColorVar]?: Hex }
  readonly fonts?: { readonly heading?: string; readonly body?: string }
}
export type SlideGroup = NodeId | "new"
export type Direction = (typeof directions)[number]
type Targets = { readonly targets: readonly NodeId[] }

export type Intent =
  | ({ readonly op: "insert"; readonly kind: LayerKind; readonly parent: NodeId } & Omit<IntentLook, "box"> & {
        readonly box?: IntentBox
      })
  | ({
      readonly op: "insert"
      readonly kind: "slide"
      readonly after?: NodeId | null
      readonly group?: SlideGroup
    } & IntentLook)
  | ({ readonly op: "update"; readonly target: string } & IntentLook)
  | ({ readonly op: "replace"; readonly target: NodeId; readonly kind: LayerKind } & IntentLook)
  | ({ readonly op: "copy" } & Targets)
  | {
      readonly op: "paste"
      readonly piece: TreeNode
      readonly parent: NodeId
      readonly box?: { readonly x: Px; readonly y: Px; readonly w?: Px; readonly h?: Px }
    }
  | ({
      readonly op: "move"
      readonly parent?: NodeId
      readonly after?: NodeId | null
      readonly before?: NodeId
      readonly group?: SlideGroup
      readonly box?: NonNullable<IntentLook["box"]>
    } & Targets)
  | ({ readonly op: "reorder"; readonly direction: Direction } & Targets)
  | ({ readonly op: "remove" } & Targets)
  | ({ readonly op: "group" } & Targets & IntentLook)
  | { readonly op: "ungroup"; readonly target: NodeId }
  | ({ readonly op: "variables" } & DeckLook)

export type IntentRefusal = Refusal & {
  readonly change: string
  readonly at?: number
  readonly field?: string
  readonly kind?: NodeKind
}

const colorSchema = { $ref: "#/$defs/color" }
const tintedName = new RegExp(`^(${colorVars.join("|")})([+-](100|[1-9][0-9]?))?$`)
export const readColor = colorMatching(tintedName, 16, { code: "theme-color" }) as Reader<IntentColor>
const id = () => field<NodeId>(idSchema, readId)

const readNone = literal(["none"] as const)

const readFontName = matching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,99}$/, 100, { code: "font-name" })
const readIconName = matching(/^([a-z0-9-]+\/)?[a-z0-9-]+$/, 80, { code: "icon-name" })

const boxSides = { x: px(), y: px(), w: size, h: size }

type LookFields = { readonly [K in keyof IntentLook]-?: Field<Exclude<IntentLook[K], undefined>> }

const lookFields: LookFields = {
  language: languageField,
  d: field(
    {
      type: "string",
      maxLength: pathLimit,
    },
    readPathData,
  ),
  fillStroke: flag(),
  fill: field(
    {
      anyOf: [
        colorSchema,
        { const: "none" },
        {
          type: "object",
          additionalProperties: false,
          required: ["image"],
          properties: { image: { type: "string" } },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["gradient"],
          properties: {
            gradient: { type: "array", items: colorSchema, minItems: 2, maxItems: 8 },
            angle: { type: "number" },
            radial: { type: "boolean" },
          },
        },
      ],
    },
    union<IntentFill>({ code: "fill" }, [
      readColor,
      readNone,
      object({ image: words(limits.address, 1) }),
      object({ gradient: list(readColor, 8, 2) }, { angle: readAngle, radial: boolean }),
    ]),
  ),
  stroke: field({ anyOf: [colorSchema, { const: "none" }] }, union({ code: "stroke" }, [readColor, readNone])),
  strokeWidth: number(0, 200),
  color: field({ ...colorSchema }, readColor),
  radius: number(0, 10_000),
  effect: choice<EffectStyleName | "none">([...effectStyleNames, "none"]),
  effectOpacity: number(0, 1),
  link: linkField,
  clip: flag(),
  mask: flag(),
  opacity: number(0, 1),
  text: string(limits.valueBytes),
  insert: insertField,
  textStyle: choice(textStyleNames),
  align: choice(["left", "center", "right", "justify"]),
  layout: choice(["row", "column", "none"]),
  gap: number(0, 1_000),
  padding: field<Px | Sides>(
    {
      anyOf: [
        { type: "number", minimum: 0, maximum: 1_000 },
        {
          type: "object",
          required: ["t", "r", "b", "l"],
          additionalProperties: false,
          properties: Object.fromEntries(
            ["t", "r", "b", "l"].map((side) => [side, { type: "number", minimum: 0, maximum: 1_000 }]),
          ),
        },
      ],
    },
    union<Px | Sides>({ code: "padding" }, [
      finite(0, 1_000),
      object({ t: finite(0, 1_000), r: finite(0, 1_000), b: finite(0, 1_000), l: finite(0, 1_000) }),
    ]),
  ),
  icon: field({ type: "string" }, readIconName),
  arrow: arrowField,
  startArrow: startArrowField,
  from: field(endSchema, readEnd),
  to: field(endSchema, readEnd),
  route: choice(["straight", "elbow", "curve"]),
  lane: number(-10_000, 10_000),
  rows: field(
    {
      type: "array",
      items: { type: "array", items: { type: "string" } },
    },
    list(list(words(limits.valueBytes), 24, 1), 64, 1),
  ),
  box: field(
    {
      type: "object",
      additionalProperties: false,
      properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
    },
    object({}, boxSides),
  ),
  name: field<string>({ type: "string" }, (raw) => {
    const name = words(limits.name, 1)(raw)
    return name.trim() === "" ? wrongForm({ code: "nonempty-string" }) : name
  }),
  hidden: flag(),
  locked: flag(),
  size: number(1, 2_000),
  font: field({ type: "string" }, readFontName),
  weight: choice(weightNames),
  lineHeight: number(0.5, 5),
  letterSpacing: number(-100, 100),
  case: choice(["none", "upper", "lower", "title"]),
  underline: flag(),
  strike: flag(),
  dash: choice(["solid", "dash", "dot"]),
  fit: choice(["fill", "fit", "crop", "tile"]),
  crop: cropField,
  shape: choice(shapeNames),
  rotation: field<number>({ type: "number" }, readRotation),
  flip: choice(["none", "h", "v", "hv"]),
  notes: field({ type: "string" }, words(limits.valueBytes)),
  ...slideLookFields,
  ...innerShadowFields(readColor),
}

const readTarget = matching(/^([a-z0-9]{1,16}:[0-9]{1,12}(\.(title|subtitle|body))?|\*\.(title|subtitle|body))$/, 440, {
  code: "target-role",
})

const directions = ["front", "back", "forward", "backward"] as const
const groupSchema = { oneOf: [idSchema, { const: "new" }] }

const placeFields = {
  kind: choice(nodeKinds),
  parent: id(),
  target: field({ type: "string" }, readTarget),
  targets: field(
    { type: "array", items: idSchema, minItems: 1, maxItems: limits.delete },
    list(readId, limits.delete, 1),
  ),
  after: field({ oneOf: [idSchema, { type: "null" }] }, readAfter),
  before: id(),
  group: field(groupSchema, readGroup),
  direction: choice(directions),
  theme: field(
    {
      type: "object",

      required: ["colors", "fonts", "textStyles", "effectStyles"],
      properties: {
        colors: { type: "object" },
        fonts: { type: "object" },
        textStyles: { type: "object" },
        effectStyles: { type: "object" },
      },
      additionalProperties: false,
    },
    readTheme,
  ),
  colors: field(
    {
      type: "object",
      additionalProperties: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    },
    object({}, Object.fromEntries(colorVars.map((name) => [name, readHex])) as Record<ColorVar, Reader<Hex>>),
  ),
  fonts: field(
    {
      type: "object",
      additionalProperties: false,
      properties: { heading: { type: "string" }, body: { type: "string" } },
    },
    object({}, { heading: readFontName, body: readFontName }),
  ),
  nameFollows: flag(),
} as const

const pickFrom = <T extends { readonly [P in keyof T]: Field<unknown> }, K extends keyof T>(
  source: T,
  keys: readonly K[],
) =>
  Object.fromEntries(keys.map((key) => [key, source[key].read])) as {
    [P in K]: T[P] extends Field<infer V> ? Reader<V> : never
  }

const lookReaders = pickFrom(lookFields, Object.keys(lookFields) as (keyof typeof lookFields)[])
const readLayerKind = literal(layerKinds)
const readInsertLayer = object(
  { parent: readId, kind: literal(nodeKinds) as Reader<LayerKind> },
  { ...lookReaders, box: object(boxSides) },
)
const readInsertSlide = object(
  { kind: literal(["slide"]) },
  { ...pickFrom(placeFields, ["after", "group"]), ...lookReaders },
)
const readInsert = (raw: unknown) =>
  typeof raw === "object" && raw !== null && (raw as { kind?: unknown }).kind === "slide"
    ? readInsertSlide(raw)
    : readInsertLayer(raw)

const read = variant("op", {
  insert: readInsert,
  update: object(pickFrom(placeFields, ["target"]), lookReaders),
  replace: object({ target: readId, kind: readLayerKind }, lookReaders),
  copy: object(pickFrom(placeFields, ["targets"])),
  move: object(pickFrom(placeFields, ["targets"]), {
    ...pickFrom(placeFields, ["parent", "after", "before", "group"]),
    box: lookFields.box.read,
  }),
  reorder: object(pickFrom(placeFields, ["targets", "direction"])),
  remove: object(pickFrom(placeFields, ["targets"])),
  group: object(pickFrom(placeFields, ["targets"]), lookReaders),
  ungroup: object({ target: readId }),
  variables: object(
    {},
    {
      ...pickFrom(lookFields, ["name", "language"]),
      ...pickFrom(placeFields, ["theme", "colors", "fonts", "nameFollows"]),
    },
  ),
})

export const intentOps = [
  "insert",
  "update",
  "replace",
  "copy",
  "move",
  "reorder",
  "remove",
  "group",
  "ungroup",
  "variables",
] as const

export function readIntent(raw: unknown): Intent | (Refusal & { readonly field?: string }) {
  try {
    return read(raw) as Intent
  } catch (thrown) {
    return detailOf(thrown)
  }
}

export const lookNames = Object.keys(lookFields) as readonly (keyof IntentLook)[]

const schemasOf = (source: Readonly<Record<string, Field<unknown>>>) =>
  Object.fromEntries(Object.entries(source).map(([key, each]) => [key, each.schema]))

export const intentsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      minItems: 1,
      maxItems: limits.batch,
      items: { $ref: "#/$defs/change" },
    },
  },
  $defs: {
    id: { type: "string", pattern: "^[a-z0-9]{1,16}:[0-9]{1,12}$" },
    color: {
      type: "string",
      pattern: /^((text|background|text2|background2|accent[1-6]|link)([+-][0-9]{1,3})?|#[0-9a-fA-F]{6})$/.source,
    },
    change: {
      type: "object",
      additionalProperties: false,
      required: ["op"],
      properties: {
        op: { enum: intentOps },
        ...schemasOf(placeFields),
        kind: { enum: nodeKinds },
        ...schemasOf(lookFields),
      },
    },
  },
} as const
