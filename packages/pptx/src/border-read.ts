import {
  arrowheads,
  arrowSizes,
  borderCaps,
  borderCompounds,
  borderJoins,
  widestBorder,
  type Color,
  type FieldName,
  type FieldValue,
} from "@airdesign/document"
import { readDash } from "./dash-markup.js"
import { colorIn, fillIn } from "./color-read.js"
import { fillValueOf } from "./fill-read.js"
import { child, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { drawnShape } from "./paint-sheet.js"
import { ownersOf, propertiesOf, sheetOf, stylesOf } from "./trait-read.js"

export type BorderField = Exclude<FieldName<"border">, "alpha">

export type ShownBorder = {
  readonly [F in BorderField]: { readonly value: FieldValue<"border", F> | null; readonly own: boolean }
}

export type BorderAt = { readonly part: string; readonly shape: string }

type Level = { readonly line: Held; readonly placed: Color | null; readonly own: boolean }

type Arrow = FieldValue<"border", "head">

function levelsOf(parts: ReadonlyMap<string, Uint8Array>, at: BorderAt): readonly Level[] | null {
  const item = drawnShape(parts, at.part, at.shape)
  if (item === null) return null
  const layout = item.placeholder === null ? null : sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const owners = ownersOf(item, { sheet: item, layout, master })
  const levels: Level[] = owners.flatMap((owner, at) => {
    const line = child(propertiesOf(owner), "a:ln")
    return line === undefined ? [] : [{ line, placed: null, own: at === 0 }]
  })
  const reference = owners.map((owner) => child(child(owner, "p:style"), "a:lnRef")).find((each) => each !== undefined)
  const index = reference === undefined ? 0 : (whole(reference.element, "idx") ?? 0)
  if (index >= 1) {
    const resolvedLayout = layout ?? sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
    const resolvedMaster =
      master ?? (resolvedLayout === null ? null : sheetOf(parts, linkedPart(parts, resolvedLayout.part, "slideMaster")))
    const theme = resolvedMaster === null ? null : sheetOf(parts, linkedPart(parts, resolvedMaster.part, "theme"))
    const entry = stylesOf(theme).lines[index - 1]
    if (entry !== undefined) levels.push({ line: entry, placed: colorIn(reference, null), own: false })
  }
  return levels
}

function oneOf<const T extends string>(options: readonly T[], text: string | null): T | null {
  return options.find((option) => option === text) ?? null
}

type Reader<V> = (level: Level) => V | null | undefined

function first<V>(levels: readonly Level[], pick: Reader<V>, fallback: V | null) {
  for (const level of levels) {
    const value = pick(level)
    if (value !== undefined) return { value, own: level.own }
  }
  return { value: fallback, own: false }
}

function attribute<const T extends string>(name: string, options: readonly T[]): Reader<T> {
  return ({ line }) => {
    const text = paintAttribute(line.element, name)
    return text === null ? undefined : oneOf(options, text)
  }
}

const width: Reader<number> = ({ line }) => {
  if (paintAttribute(line.element, "w") === null) return undefined
  const value = whole(line.element, "w")
  return value === undefined || value < 0 || value > widestBorder ? null : value
}

const fill: Reader<FieldValue<"border", "fill">> = ({ line, placed }) => {
  const held = fillIn(line)
  if (held === undefined) return undefined
  const value = fillValueOf(held, placed)
  return value === null || "group" in value || "image" in value ? null : value
}

const join: Reader<FieldValue<"border", "join">> = ({ line }) => {
  const found = borderJoins.find((kind) => child(line, `a:${kind}`) !== undefined)
  return found ?? undefined
}

function arrowOf(levels: readonly Level[], tag: "a:headEnd" | "a:tailEnd") {
  const part = <const T extends string>(name: string, options: readonly T[]): Reader<T> => {
    return ({ line }) => {
      const end = child(line, tag)
      const text = end === undefined ? null : paintAttribute(end.element, name)
      return text === null ? undefined : oneOf(options, text)
    }
  }
  const type = first(levels, part("type", arrowheads), "none").value
  const size = first(levels, part("w", arrowSizes), "med").value
  const length = first(levels, part("len", arrowSizes), "med").value
  const value: Arrow | null = type === null || size === null || length === null ? null : { type, width: size, length }
  return { value, own: levels[0]?.own === true && child(levels[0].line, tag) !== undefined }
}

const capReader = attribute("cap", borderCaps)
const compoundReader = attribute("cmpd", borderCompounds)

export function shownBorderField<F extends BorderField>(
  parts: ReadonlyMap<string, Uint8Array>,
  at: BorderAt,
  name: F,
): ShownBorder[F] | null {
  const levels = levelsOf(parts, at)
  if (levels === null) return null
  if (name === "width") return first(levels, width, null) as ShownBorder[F]
  if (name === "fill") return first(levels, fill, { none: true }) as ShownBorder[F]
  if (name === "dash") return first(levels, ({ line }) => readDash(line), "solid") as ShownBorder[F]
  if (name === "cap") return first(levels, capReader, "flat") as ShownBorder[F]
  if (name === "compound") return first(levels, compoundReader, "sng") as ShownBorder[F]
  if (name === "join") return first(levels, join, "round") as ShownBorder[F]
  if (name === "head") return arrowOf(levels, "a:headEnd") as ShownBorder[F]
  return arrowOf(levels, "a:tailEnd") as ShownBorder[F]
}

export function shownBorder(parts: ReadonlyMap<string, Uint8Array>, at: BorderAt): ShownBorder | null {
  const levels = levelsOf(parts, at)
  if (levels === null) return null
  return {
    width: first(levels, width, null),
    fill: first(levels, fill, { none: true }),
    dash: first(levels, ({ line }) => readDash(line), "solid"),
    cap: first(levels, capReader, "flat"),
    compound: first(levels, compoundReader, "sng"),
    join: first(levels, join, "round"),
    head: arrowOf(levels, "a:headEnd"),
    tail: arrowOf(levels, "a:tailEnd"),
  }
}
