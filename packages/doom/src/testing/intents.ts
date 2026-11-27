import fc from "fast-check"
import { intentHexes, shortHex, themeHexes } from "./intent-changes-art.js"
import { slideOf } from "../doom-walk.js"
import type { Doom } from "../doom.js"
import { lineArrowheads } from "../geometry.js"
import type { NodeId } from "../ids.js"
import { colorVars, effectStyleNames } from "../paint.js"
import { weightNames } from "../painted-face.js"
import { shapeNames } from "../preset-geometry.js"
import { textStyleNames } from "../text.js"
import { layerKinds, lookFieldsOf } from "../kind-fields.js"
import { testTheme } from "./theme.js"

type Pool = "slide" | "group" | "layer" | "frame" | "any"

class Ref {
  readonly pool: Pool
  readonly pick: number
  constructor(pool: Pool, pick: number) {
    this.pool = pool
    this.pick = pick
  }
}

class RoleRef {
  readonly slide: Ref
  readonly role: string
  constructor(slide: Ref, role: string) {
    this.slide = slide
    this.role = role
  }
}

class Place {
  readonly pick: number
  readonly inFrame: boolean
  constructor(pick: number, inFrame: boolean) {
    this.pick = pick
    this.inFrame = inFrame
  }
}

const rare = <T, U>(usual: fc.Arbitrary<T>, odd: fc.Arbitrary<U>) =>
  fc.oneof({ weight: 19, arbitrary: usual }, { weight: 1, arbitrary: odd })

const ref = (pool: Pool) =>
  rare(
    fc.nat(40).map((pick) => new Ref(pool, pick)),
    fc.oneof(
      fc.nat(40).map((pick) => new Ref("any", pick)),
      fc.constantFrom("z:404", "t:1", "bad id"),
    ),
  )
const refs = (pool: Pool, max: number) => fc.array(ref(pool), { minLength: 1, maxLength: max })

function poolsOf(doom: Doom): Readonly<Record<Pool, readonly NodeId[]>> {
  const nodes = [...doom.nodes.values()].filter((node) => (node as { parent?: unknown }).parent !== null)
  const of = (...types: readonly string[]) => nodes.filter((node) => types.includes(node.type)).map((node) => node.id)
  return {
    slide: of("slide"),
    group: of("slideRow"),
    layer: of("frame", "shape"),
    frame: of("frame"),
    any: nodes.map((node) => node.id),
  }
}

export function resolveRefs(doom: Doom, raw: unknown): unknown {
  const pools = poolsOf(doom)
  const pickFrom = (pool: readonly NodeId[], pick: number) => (pool.length === 0 ? "z:404" : pool[pick % pool.length]!)
  const placeOf = ({ pick, inFrame }: Place) => {
    const frame = inFrame ? pools.frame[pick % Math.max(1, pools.frame.length)] : undefined
    const slide = frame === undefined ? undefined : slideOf(doom, frame)
    return frame === undefined || slide === undefined ? { parent: pickFrom(pools.slide, pick) } : { parent: frame }
  }
  const walk = (value: unknown): unknown => {
    if (value instanceof Ref) return pickFrom(pools[value.pool], value.pick)
    if (value instanceof RoleRef) return `${walk(value.slide) as string}.${value.role}`
    if (Array.isArray(value)) return value.map(walk)
    if (typeof value === "object" && value !== null)
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, each]) =>
          each instanceof Place ? Object.entries(placeOf(each)) : [[key, walk(each)]],
        ),
      )
    return value
  }
  return walk(raw)
}

const fieldTestText = fc.constantFrom(
  "Line one\nLine two",
  "Line one\r\nLine two",
  "One\n\nTwo\n\n\nThree",
  "\n",
  "\n\n",
  "   ",
  "trailing\n",
  "\nleading",
  "- one\n- two\n  - nested\n- three",
  "1. first\n2. second\n\n3. third",
  "**bold** *italic* ++under++ ~~strike~~",
  "**unclosed *nested",
  "[label](https://example.com) and [slide](t:3)",
  "[broken](not a url)",
  "Revenue\tgrew 12%",
  "مرحبا بالعالم",
  "收入增长了百分之十二",
  "👩‍👩‍👧 family 🇻🇳",
  "é́",
  "​‍  ",
  "# Heading\n> quote\n```code```",
  "a".repeat(600),
  JSON.stringify({ paras: [{ from: -1, runs: [{ from: -1, text: "x" }] }] }),
)

export const agentText = rare(
  fc.oneof(
    fieldTestText,
    fc.string({ minLength: 1, maxLength: 40 }),
    fc
      .array(fc.constantFrom("Q3", "revenue ", "\n", "**", "- ", "  ", "1. ", "\t", "é", "→", "[x](https://a.co)"), {
        minLength: 1,
        maxLength: 12,
      })
      .map((parts) => parts.join("")),
  ),
  fc.constantFrom("", "lone \ud800 surrogate", "bell\u0007"),
)

const numberIn = (min: number, max: number) =>
  rare(
    fc.oneof(fc.integer({ min: Math.ceil(min), max: Math.floor(max) }), fc.double({ min, max, noNaN: true })),
    fc.constantFrom(min - 1, max + 1, -0, 1e12, Number.NaN, Infinity),
  )

const color = rare(
  fc.oneof(
    fc.constantFrom(...colorVars),
    fc
      .tuple(fc.constantFrom(...colorVars), fc.constantFrom("+40", "-20", "+100", "-100"))
      .map(([name, tint]) => `${name}${tint}`),
    fc.constantFrom(...intentHexes),
  ),
  fc.constantFrom(shortHex, "red", "accent9", "text+101"),
)

const box = fc.record({ x: numberIn(-200, 2200), y: numberIn(-200, 1300), w: numberIn(0, 2000), h: numberIn(0, 1200) })

const end = fc.oneof(
  fc.record(
    { layer: ref("layer"), side: fc.constantFrom("top", "right", "bottom", "left", "center") },
    { requiredKeys: ["layer"] },
  ),
  fc.record({ x: numberIn(-200, 2200), y: numberIn(-200, 1300) }),
)

const cell = fc.oneof(agentText, fc.constantFrom("", "12%", "**Total**", "a\nb", "- x\n- y"))

export const agentRows = rare(
  fc.array(fc.array(cell, { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 5 }),
  fc.constantFrom([], [[]], [["a"], []]),
)

const font = rare(fc.constantFrom("Inter", "Roboto Mono", "No Such Font"), fc.constant("Inter\nBold"))

const look = {
  text: agentText,
  insert: fc.record({
    at: fc.nat(80),
    text: agentText,
    link: fc.oneof(fc.constant("https://example.com"), ref("slide")),
  }),
  fill: fc.oneof(
    color,
    fc.constant("none"),
    fc.record(
      {
        gradient: fc.array(color, { minLength: 2, maxLength: 4 }),
        angle: numberIn(-720, 720),
        radial: fc.boolean(),
      },
      { requiredKeys: ["gradient"] },
    ),
    fc.constant({ image: "https://example.com/a.png" }),
  ),
  stroke: fc.oneof(color, fc.constant("none")),
  strokeWidth: numberIn(0, 200),
  color,
  radius: numberIn(0, 10_000),
  effect: fc.constantFrom(...effectStyleNames, "none"),
  effectOpacity: numberIn(0, 1),
  link: fc.oneof(fc.constantFrom("https://example.com", "mailto:a@b.co", "none"), ref("slide")),
  clip: fc.boolean(),
  mask: fc.boolean(),
  opacity: numberIn(0, 1),
  textStyle: fc.constantFrom(...textStyleNames),
  align: fc.constantFrom("left", "center", "right", "justify"),
  layout: fc.constantFrom("row", "column", "none"),
  gap: numberIn(0, 1_000),
  padding: fc.oneof(
    numberIn(0, 1_000),
    fc.record({ t: numberIn(0, 1_000), r: numberIn(0, 1_000), b: numberIn(0, 1_000), l: numberIn(0, 1_000) }),
  ),
  icon: fc.constantFrom("star", "lucide/star", "arrow-right", "no-such-icon"),
  arrow: fc.oneof(fc.boolean(), fc.constantFrom(...lineArrowheads)),
  startArrow: fc.constantFrom(...lineArrowheads),
  from: end,
  to: end,
  route: fc.constantFrom("straight", "elbow", "curve"),
  box,
  name: agentText,
  hidden: fc.boolean(),
  locked: fc.boolean(),
  size: numberIn(1, 2_000),
  font,
  weight: fc.constantFrom(...weightNames),
  lineHeight: numberIn(0.5, 5),
  letterSpacing: numberIn(-100, 100),
  case: fc.constantFrom("none", "upper", "lower", "title"),
  underline: fc.boolean(),
  strike: fc.boolean(),
  dash: fc.constantFrom("solid", "dash", "dot"),
  fit: fc.constantFrom("fill", "fit", "crop", "tile"),
  crop: fc.record(
    { left: numberIn(0, 49), top: numberIn(0, 49), right: numberIn(0, 49), bottom: numberIn(0, 49) },
    { requiredKeys: [] },
  ),
  shape: rare(fc.constantFrom(...shapeNames), fc.constant("no-such-shape")),
  rotation: numberIn(-720, 720),
  flip: fc.constantFrom("none", "h", "v", "hv"),
  notes: agentText,
  skipped: fc.boolean(),
  transition: fc.record({ kind: fc.constantFrom("none", "fade", "push", "smartMove"), ms: fc.nat(60_000) }),
  alignV: fc.constantFrom("top", "center", "bottom"),
  spaceBefore: numberIn(0, 1_000),
  spaceAfter: numberIn(0, 1_000),
  blur: numberIn(0, 1_000),
  innerShadow: fc.oneof(
    fc.constant("none"),
    fc.record({
      color,
      x: numberIn(-1_000, 1_000),
      y: numberIn(-1_000, 1_000),
      blur: numberIn(0, 1_000),
      spread: numberIn(-1_000, 1_000),
    }),
  ),
  d: fc.constantFrom("M0 0 L1 1 Z", "M0 0 C0.5 0 0.5 1 1 1", "M 0 0 L 1", "Z"),
  fillStroke: fc.boolean(),
  language: rare(fc.constantFrom("en", "vi", "ar", "zh-Hans", "und"), fc.constant("not a language")),
  rows: agentRows,
} as const

type LookKey = keyof typeof look

const kindKeys: Readonly<Record<string, readonly LookKey[]>> = Object.fromEntries(
  layerKinds.map((kind) => [kind, lookFieldsOf("insert", kind).filter((key): key is LookKey => key in look)]),
)

const needs: Readonly<Record<string, readonly LookKey[]>> = {
  text: ["text"],
  path: ["d"],
  icon: ["icon"],
}

const allKeys = Object.keys(look) as LookKey[]

const lookOf = (keys: readonly LookKey[], max: number, needed: readonly LookKey[] = []) =>
  fc
    .tuple(
      fc.uniqueArray(fc.constantFrom(...keys), { maxLength: max }),
      rare(
        fc.constant([]),
        fc.constantFrom(...allKeys).map((key) => [key]),
      ),
    )
    .chain(([chosen, odd]) =>
      fc.record(Object.fromEntries([...new Set([...needed, ...chosen, ...odd])].map((key) => [key, look[key]]))),
    )

const add = fc
  .constantFrom(...Object.keys(kindKeys))
  .chain((kind) =>
    fc.record({
      kind: fc.constant(kind),
      place: fc.tuple(fc.nat(40), fc.nat(5)).map(([pick, odds]) => new Place(pick, odds === 0)),
      look: lookOf(kindKeys[kind]!, 4, needs[kind]),
    }),
  )
  .map(({ kind, place, look: chosen }) => ({
    op: "insert",
    kind,
    place,
    ...chosen,
    ...(kind === "picture" ? { fill: { image: "https://example.com/a.png" } } : {}),
  }))

const table = fc
  .record({
    place: fc.nat(40).map((pick) => new Place(pick, false)),
    rows: agentRows,
    look: lookOf(["box", "fill", "gap", "padding"], 2),
  })
  .map(({ place, rows, look: chosen }) => ({ op: "insert", kind: "frame", place, rows, ...chosen }))

const target = fc.oneof(
  { weight: 6, arbitrary: ref("layer") },
  { weight: 1, arbitrary: ref("slide") },
  {
    weight: 1,
    arbitrary: fc
      .tuple(fc.nat(40), fc.constantFrom("title", "subtitle", "body"))
      .map(([pick, role]) => new RoleRef(new Ref("slide", pick), role)),
  },
  { weight: 1, arbitrary: fc.constantFrom("*.title", "*.subtitle", "*.body") },
)

const set = fc
  .record({
    target,
    look: lookOf(
      allKeys.filter((key) => key !== "rows"),
      3,
    ),
  })
  .map(({ target: on, look: chosen }) => ({ op: "update", target: on, ...chosen }))

const move = fc.oneof(
  fc
    .record({ node: ref("layer"), after: fc.oneof(ref("layer"), fc.constant(null)) }, { requiredKeys: ["node"] })
    .map(({ node, ...where }) => ({ op: "move", targets: [node], ...where })),
  fc
    .record({ node: ref("layer"), parent: ref("frame") }, { requiredKeys: ["node", "parent"] })
    .map(({ node, ...where }) => ({ op: "move", targets: [node], ...where })),
  fc
    .record({ targets: refs("layer", 3), parent: ref("slide"), box }, { requiredKeys: ["targets", "parent"] })
    .map((fields) => ({ op: "move", ...fields })),
  fc
    .record({ targets: refs("layer", 3), direction: fc.constantFrom("front", "back", "forward", "backward") })
    .map((fields) => ({ op: "reorder", ...fields })),
)

const structure = fc.oneof(
  fc
    .record(
      { targets: refs("layer", 4), layout: fc.constantFrom("row", "column", "none"), clip: fc.boolean() },
      { requiredKeys: ["targets"] },
    )
    .map((fields) => ({ op: "group", ...fields })),
  ref("frame").map((node) => ({ op: "ungroup", target: node })),
  fc.oneof(refs("layer", 3), refs("slide", 1), refs("any", 2)).map((nodes) => ({ op: "remove", targets: nodes })),
  fc.oneof(refs("layer", 3), refs("slide", 2)).map((nodes) => ({ op: "copy", targets: nodes })),
)

const slide = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .record({ after: ref("slide") }, { requiredKeys: [] })
      .map((fields) => ({ op: "insert", kind: "slide", ...fields })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record(
        { group: fc.constant("new"), after: fc.oneof(ref("group"), fc.constant(null)) },
        { requiredKeys: ["group"] },
      )
      .map((fields) => ({ op: "insert", kind: "slide", ...fields })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({ slide: ref("slide"), after: fc.oneof(ref("slide"), fc.constant(null)) })
      .map(({ slide: moved, after }) => ({ op: "move", targets: [moved], after })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({
        targets: refs("slide", 2),
        group: fc.constant("new"),
        after: fc.oneof(ref("group"), fc.constant(null)),
      })
      .map((fields) => ({ op: "move", ...fields })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({ group: ref("group"), before: ref("group") })
      .map(({ group, before }) => ({ op: "move", targets: [group], before })),
  },
  { weight: 1, arbitrary: ref("slide").map((each) => ({ op: "remove", targets: [each] })) },
)

const deck = fc
  .record(
    {
      name: agentText,
      nameFollows: fc.boolean(),
      language: look.language,
      theme: rare(
        fc.constant({ ...testTheme, fonts: { heading: "Lora", body: "Inter" } }),
        fc.constant("no-such-theme"),
      ),
      colors: fc.dictionary(fc.constantFrom(...colorVars), fc.constantFrom(...themeHexes), {
        maxKeys: 3,
      }),
      fonts: fc.record({ heading: font, body: font }, { requiredKeys: [] }),
    },
    { requiredKeys: [] },
  )
  .map((fields) => ({ op: "variables", ...fields }))

export const intent = fc.oneof(
  { weight: 6, arbitrary: add },
  { weight: 2, arbitrary: table },
  { weight: 5, arbitrary: set },
  { weight: 2, arbitrary: move },
  { weight: 2, arbitrary: structure },
  { weight: 2, arbitrary: slide },
  { weight: 1, arbitrary: deck },
)

export const agentBatches = fc.array(fc.array(intent, { minLength: 1, maxLength: 3 }), {
  minLength: 1,
  maxLength: 4,
})
