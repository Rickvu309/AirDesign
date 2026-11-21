import { anchors, mostColumns, verticals, type FieldName, type FieldValue } from "@airdesign/document"
import { child, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { drawnShape } from "./paint-sheet.js"
import { ownersOf, sheetOf } from "./trait-read.js"

export type BodyField = FieldName<"body">

export type ShownBody = {
  readonly [F in BodyField]: { readonly value: FieldValue<"body", F> | null; readonly own: boolean }
}

export type BodyAt = { readonly part: string; readonly shape: string }

export type BodyLevel = { readonly frame: Held; readonly own: boolean }

type Reader<V> = (frame: Held) => V | null | undefined

type Insets = FieldValue<"body", "insets">

export const standardInsets: Insets = { left: 91_440, top: 45_720, right: 91_440, bottom: 45_720 }

export const insetNames = { left: "lIns", top: "tIns", right: "rIns", bottom: "bIns" } as const

export const fitTags = { none: "a:noAutofit", shrink: "a:normAutofit", grow: "a:spAutoFit" } as const

const insetEntries = Object.entries(insetNames) as readonly (readonly [keyof Insets, string])[]
const fitEntries = Object.entries(fitTags) as readonly (readonly [keyof typeof fitTags, string])[]

export function bodyLevels(parts: ReadonlyMap<string, Uint8Array>, at: BodyAt): readonly BodyLevel[] | null {
  const item = drawnShape(parts, at.part, at.shape)
  if (item === null) return null
  const layout = item.placeholder === null ? null : sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const owners = ownersOf(item, { sheet: item, layout, master })
  if (child(owners[0], "p:txBody") === undefined) return null
  return owners.flatMap((owner, at) => {
    const frame = child(child(owner, "p:txBody"), "a:bodyPr")
    return frame === undefined ? [] : [{ frame, own: at === 0 }]
  })
}

function first<V>(levels: readonly BodyLevel[], pick: Reader<V>, fallback: V) {
  for (const level of levels) {
    const value = pick(level.frame)
    if (value !== undefined) return { value, own: level.own }
  }
  return { value: fallback, own: false }
}

function oneOf<const T extends string>(name: string, options: readonly T[]): Reader<T> {
  return (frame) => {
    const text = paintAttribute(frame.element, name)
    return text === null ? undefined : (options.find((option) => option === text) ?? null)
  }
}

function inset(name: string): Reader<number> {
  return (frame) => {
    if (paintAttribute(frame.element, name) === null) return undefined
    const value = whole(frame.element, name)
    return value === undefined || value < 0 ? null : value
  }
}

const wrap: Reader<boolean> = (frame) => {
  const text = paintAttribute(frame.element, "wrap")
  if (text === null) return undefined
  return text === "square" ? true : text === "none" ? false : null
}

const autofit: Reader<FieldValue<"body", "autofit">> = (frame) => {
  const found = inside(frame).find((item) => fitEntries.some(([, tag]) => tag === item.kind))
  return found === undefined ? undefined : fitEntries.find(([, tag]) => tag === found.kind)?.[0]
}

const columns: Reader<number> = (frame) => {
  if (paintAttribute(frame.element, "numCol") === null) return undefined
  const value = whole(frame.element, "numCol")
  return value === undefined || value < 1 || value > mostColumns ? null : value
}

const anchorReader = oneOf("anchor", anchors)
const verticalReader = oneOf("vert", verticals)

function insetsOf(levels: readonly BodyLevel[]) {
  const sides = insetEntries.map(([side, name]) => [side, first(levels, inset(name), standardInsets[side])] as const)
  const known = sides.every(([, shown]) => shown.value !== null)
  const value = known ? (Object.fromEntries(sides.map(([side, shown]) => [side, shown.value])) as Insets) : null
  return { value, own: sides.some(([, shown]) => shown.own) }
}

export function bodyFieldFrom<F extends BodyField>(levels: readonly BodyLevel[], name: F): ShownBody[F] {
  if (name === "insets") return insetsOf(levels) as ShownBody[F]
  if (name === "anchor") return first(levels, anchorReader, "t") as ShownBody[F]
  if (name === "wrap") return first(levels, wrap, true) as ShownBody[F]
  if (name === "autofit") return first(levels, autofit, "none") as ShownBody[F]
  if (name === "vertical") return first(levels, verticalReader, "horz") as ShownBody[F]
  return first(levels, columns, 1) as ShownBody[F]
}

export function shownBody(parts: ReadonlyMap<string, Uint8Array>, at: BodyAt): ShownBody | null {
  const levels = bodyLevels(parts, at)
  if (levels === null) return null
  return {
    insets: insetsOf(levels),
    anchor: first(levels, anchorReader, "t"),
    wrap: first(levels, wrap, true),
    autofit: first(levels, autofit, "none"),
    vertical: first(levels, verticalReader, "horz"),
    columns: first(levels, columns, 1),
  }
}
