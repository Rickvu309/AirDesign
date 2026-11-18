import {
  arrowheads,
  arrowSizes,
  dashPresets,
  lineCaps,
  lineCompounds,
  lineJoins,
  widestLine,
  type Color,
  type FieldName,
  type FieldValue,
} from "@airdesign/document"
import { colorIn, fillIn } from "./color-read.js"
import { fillValueOf } from "./fill-read.js"
import { child, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { ownersOf, propertiesOf, sheetOf, stylesOf } from "./trait-read.js"

export type LineField = Exclude<FieldName<"line">, "alpha">

export type ShownLine = {
  readonly [F in LineField]: { readonly value: FieldValue<"line", F> | null; readonly own: boolean }
}

export type LineAt = { readonly part: string; readonly shape: string }

type Level = { readonly line: Held; readonly placed: Color | null; readonly own: boolean }

type Arrow = FieldValue<"line", "head">

function levelsOf(parts: ReadonlyMap<string, Uint8Array>, at: LineAt): readonly Level[] | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const theme = master === null ? null : sheetOf(parts, linkedPart(parts, master.part, "theme"))
  const owners = ownersOf(item, { sheet, layout, master, theme })
  const levels: Level[] = owners.flatMap((owner, at) => {
    const line = child(propertiesOf(owner), "a:ln")
    return line === undefined ? [] : [{ line, placed: null, own: at === 0 }]
  })
  const reference = owners.map((owner) => child(child(owner, "p:style"), "a:lnRef")).find((each) => each !== undefined)
  const index = reference === undefined ? 0 : (whole(reference.element, "idx") ?? 0)
  const entry = index < 1 ? undefined : stylesOf(theme).lines[index - 1]
  if (entry !== undefined) levels.push({ line: entry, placed: colorIn(reference, null), own: false })
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
  return value === undefined || value < 0 || value > widestLine ? null : value
}

const fill: Reader<FieldValue<"line", "fill">> = ({ line, placed }) => {
  const held = fillIn(line)
  if (held === undefined) return undefined
  const value = fillValueOf(held, placed)
  return value === null || "group" in value || "image" in value ? null : value
}

const dash: Reader<FieldValue<"line", "dash">> = ({ line }) => {
  const preset = child(line, "a:prstDash")
  if (preset !== undefined) return oneOf(dashPresets, paintAttribute(preset.element, "val") ?? "solid")
  return child(line, "a:custDash") === undefined ? undefined : null
}

const join: Reader<FieldValue<"line", "join">> = ({ line }) => {
  const found = lineJoins.find((kind) => child(line, `a:${kind}`) !== undefined)
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

export function shownLine(parts: ReadonlyMap<string, Uint8Array>, at: LineAt): ShownLine | null {
  const levels = levelsOf(parts, at)
  if (levels === null) return null
  return {
    width: first(levels, width, null),
    fill: first(levels, fill, { none: true }),
    dash: first(levels, dash, "solid"),
    cap: first(levels, attribute("cap", lineCaps), null),
    compound: first(levels, attribute("cmpd", lineCompounds), "sng"),
    join: first(levels, join, null),
    head: arrowOf(levels, "a:headEnd"),
    tail: arrowOf(levels, "a:tailEnd"),
  }
}
