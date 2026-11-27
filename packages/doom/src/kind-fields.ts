import type { IntentLook } from "./intent-look-types.js"

export const layerKinds = ["text", "shape", "line", "path", "frame", "picture", "icon"] as const
export type LayerKind = (typeof layerKinds)[number]
export const nodeKinds = ["slide", ...layerKinds] as const
export type NodeKind = (typeof nodeKinds)[number]
export type LookField = keyof IntentLook

const common = [
  "box",
  "name",
  "hidden",
  "locked",
  "opacity",
  "effect",
  "effectOpacity",
  "blur",
  "innerShadow",
  "rotation",
  "flip",
  "mask",
] as const satisfies readonly LookField[]
const painted = ["fill", "stroke", "strokeWidth", "radius", "dash"] as const satisfies readonly LookField[]
const words = [
  "text",
  "insert",
  "textStyle",
  "language",
  "align",
  "color",
  "size",
  "font",
  "weight",
  "lineHeight",
  "letterSpacing",
  "case",
  "underline",
  "strike",
  "alignV",
  "spaceBefore",
  "spaceAfter",
  "padding",
  "link",
] as const satisfies readonly LookField[]

export const kindFields: Readonly<Record<NodeKind, readonly LookField[]>> = {
  slide: ["fill", "name", "hidden", "notes", "skipped", "transition"],
  text: [...common, ...painted, ...words, "shape"],
  shape: [...common, ...painted, ...words, "shape"],
  path: [...common, ...painted, ...words, "d", "fillStroke"],
  line: [...common, "stroke", "strokeWidth", "dash", "arrow", "startArrow", "from", "to", "route", "lane"],
  frame: [...common, ...painted, "layout", "gap", "padding", "align", "rows", "clip"],
  picture: [...common, ...painted, "shape", "fit", "crop"],
  icon: [...common, "icon", "stroke", "strokeWidth"],
}

const madeOnly: ReadonlySet<LookField> = new Set(["rows"])
const heldOnly: ReadonlySet<LookField> = new Set(["insert"])

export type LookVerb = "insert" | "update"

export function lookFieldsOf(verb: LookVerb, kind: NodeKind): readonly LookField[] {
  const skipped = verb === "insert" ? heldOnly : madeOnly
  return kindFields[kind].filter((field) => !skipped.has(field))
}

const looks: ReadonlySet<string> = new Set(Object.values(kindFields).flat())

export function unfitField(verb: LookVerb, kind: NodeKind, look: object): LookField | undefined {
  const taken = new Set<string>(lookFieldsOf(verb, kind))
  return (Object.keys(look) as LookField[]).find(
    (field) => looks.has(field) && (look as Record<string, unknown>)[field] !== undefined && !taken.has(field),
  )
}
