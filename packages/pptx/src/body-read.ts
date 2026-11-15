import { anchors, mostColumns, verticals, type FieldName, type FieldValue } from "@airdesign/document"
import { child, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { ownersOf, sheetOf } from "./trait-read.js"

export type BodyField = FieldName<"body">

export type ShownBody = {
  readonly [F in BodyField]: { readonly value: FieldValue<"body", F> | null; readonly own: boolean }
}

export type BodyAt = { readonly part: string; readonly shape: string }

type Level = { readonly frame: Held; readonly own: boolean }

type Reader<V> = (frame: Held) => V | null | undefined

type Insets = FieldValue<"body", "insets">

export const standardInsets: Insets = { left: 91_440, top: 45_720, right: 91_440, bottom: 45_720 }

export const insetNames = { left: "lIns", top: "tIns", right: "rIns", bottom: "bIns" } as const

export const fitTags = { none: "a:noAutofit", shrink: "a:normAutofit", grow: "a:spAutoFit" } as const

function levelsOf(parts: ReadonlyMap<string, Uint8Array>, at: BodyAt): readonly Level[] | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const owners = ownersOf(item, { sheet, layout, master, theme: null })
  if (child(owners[0], "p:txBody") === undefined) return null
  return owners.flatMap((owner, at) => {
    const frame = child(child(owner, "p:txBody"), "a:bodyPr")
    return frame === undefined ? [] : [{ frame, own: at === 0 }]
  })
}

function first<V>(levels: readonly Level[], pick: Reader<V>, fallback: V) {
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
  const tags = Object.entries(fitTags)
  const found = inside(frame).find((item) => tags.some(([, tag]) => tag === item.kind))
  return found === undefined ? undefined : (tags.find(([, tag]) => tag === found.kind)?.[0] as keyof typeof fitTags)
}

const columns: Reader<number> = (frame) => {
  if (paintAttribute(frame.element, "numCol") === null) return undefined
  const value = whole(frame.element, "numCol")
  return value === undefined || value < 1 || value > mostColumns ? null : value
}

function insetsOf(levels: readonly Level[]) {
  const sides = Object.entries(insetNames).map(
    ([side, name]) => [side, first(levels, inset(name), standardInsets[side as keyof Insets])] as const,
  )
  const known = sides.every(([, shown]) => shown.value !== null)
  const value = known ? (Object.fromEntries(sides.map(([side, shown]) => [side, shown.value])) as Insets) : null
  return { value, own: sides.some(([, shown]) => shown.own) }
}

export function shownBody(parts: ReadonlyMap<string, Uint8Array>, at: BodyAt): ShownBody | null {
  const levels = levelsOf(parts, at)
  if (levels === null) return null
  return {
    insets: insetsOf(levels),
    anchor: first(levels, oneOf("anchor", anchors), "t"),
    wrap: first(levels, wrap, true),
    autofit: first(levels, autofit, "none"),
    vertical: first(levels, oneOf("vert", verticals), "horz"),
    columns: first(levels, columns, 1),
  }
}
