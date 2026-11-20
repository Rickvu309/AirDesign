import { dropSlots, innerSlots } from "./trait-effects.js"
import type { ElementLink } from "./link-target.js"
import { mappedSlots, templateColors, type Color, type MappedSlot, type TemplateColor } from "./color.js"
import type { Box } from "./box.js"
import { bytesOf } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { readTypeface } from "./text-value.js"

export const roles = [
  "title",
  "subtitle",
  "body",
  "date",
  "footer",
  "number",
  "picture",
  "chart",
  "table",
  "object",
] as const
export type Role = (typeof roles)[number]

export const sources = ["layout", "master", "style"] as const
export type Source = (typeof sources)[number]

export const shadowSlotKeys = [
  ...dropSlots.map((slot) => `effects.${slot}` as const),
  ...innerSlots.map((slot) => `effects.${slot}` as const),
] as const

type ShadowSlotKey = (typeof shadowSlotKeys)[number]

export const designKeys = [
  "geometry",
  "geometry.corners",
  "fills",
  "border.width",
  "border.fill",
  "border.dash",
  "border.head",
  "border.tail",
  "effects.shadow",
  ...shadowSlotKeys.slice(0, dropSlots.length),
  "effects.innerShadow",
  ...shadowSlotKeys.slice(dropSlots.length),
  "effects.glow",
  "effects.softEdge",
  "effects.blur",
  "effects.kept",
  "text.size",
  "text.color",
  "text.font",
  "text.bold",
  "body.anchor",
  "body.autofit",
  "body.vertical",
  "box.rot",
  "box.flipH",
  "box.flipV",
  "fills.source",
  "fills.weight",
  "fills.mode",
  "fills.recolor",
  "fills.crop",
  "identity.alt",
  "identity.hidden",
  "identity.locked",
  "identity.mask",
  "connection.start",
  "connection.end",
] as const
export type DesignKey = (typeof designKeys)[number]

const baseDesignKeys = designKeys.filter((key) => !shadowSlotKeys.some((slot) => slot === key))

const firstKeys: readonly DesignKey[] = ["box.rot", "box.flipH", "box.flipV", "connection.start", "connection.end"]

export const designOrder: readonly DesignKey[] = [
  ...firstKeys,
  ...baseDesignKeys.filter((key) => !firstKeys.includes(key)),
]

export type Shown = readonly [value: string | number | boolean, source?: Source]
export type Design = { readonly [Key in DesignKey]?: Shown }

export const designBytes = 400
export const designWordBytes = 200

export const templateFonts = ["major", "minor"] as const
export type TemplateFont = (typeof templateFonts)[number]

export type Palette = {
  readonly slots: { readonly [Slot in TemplateColor]?: string }
  readonly map: { readonly [Slot in MappedSlot]?: TemplateColor }
  readonly fonts?: { readonly [Font in TemplateFont]?: string }
}

export type Read<Value> = { readonly value: Value; readonly source?: Source }
export type FillRead =
  | { readonly color: Color }
  | { readonly gradient: readonly Color[] }
  | { readonly pattern: string }
  | "image"
  | "group"
export type ShadowRead = {
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly color: Color | null
}
export type GlowRead = { readonly radius: number; readonly color: Color | null }
export type RecolorRead = "grayscale" | { readonly dark: Color; readonly light: Color }
export type CropRead = { readonly l: number; readonly t: number; readonly r: number; readonly b: number }
export type BoundRead = { readonly node: string; readonly site: number }
export type TraitReads = Readonly<Partial<Record<ShadowSlotKey, Read<ShadowRead>>>> & {
  readonly geometry?: Read<string>
  readonly "geometry.corners"?: Read<number>
  readonly fills?: Read<FillRead>
  readonly "border.width"?: Read<number>
  readonly "border.fill"?: Read<FillRead>
  readonly "border.dash"?: Read<string>
  readonly "border.head"?: Read<string>
  readonly "border.tail"?: Read<string>
  readonly "effects.shadow"?: Read<ShadowRead>
  readonly "effects.innerShadow"?: Read<ShadowRead>
  readonly "effects.glow"?: Read<GlowRead>
  readonly "effects.softEdge"?: Read<number>
  readonly "effects.blur"?: Read<number>
  readonly "effects.kept"?: Read<string>
  readonly "text.size"?: Read<number>
  readonly "text.color"?: Read<Color>
  readonly "text.font"?: Read<string> & { readonly templateFont?: TemplateFont }
  readonly "text.bold"?: Read<boolean>
  readonly "body.anchor"?: Read<string>
  readonly "body.autofit"?: Read<string>
  readonly "body.vertical"?: Read<string>
  readonly "box.rot"?: Read<number>
  readonly "box.flipH"?: Read<boolean>
  readonly "box.flipV"?: Read<boolean>
  readonly "fills.source"?: Read<string>
  readonly "fills.weight"?: Read<number>
  readonly "fills.mode"?: Read<string>
  readonly "fills.recolor"?: Read<RecolorRead>
  readonly "fills.crop"?: Read<CropRead>
  readonly "identity.alt"?: Read<string>
  readonly "identity.hidden"?: Read<boolean>
  readonly "identity.locked"?: Read<boolean>
  readonly "identity.mask"?: Read<boolean>
  readonly "connection.start"?: Read<BoundRead>
  readonly "connection.end"?: Read<BoundRead>
}
export type ElementRead = {
  readonly link?: ElementLink
  readonly role?: Role
  readonly reads: TraitReads
  readonly kept: readonly DesignKey[]
  readonly placed?: Box
}

function named<T extends string>(names: readonly T[], value: unknown): T | undefined {
  return names.find((name) => name === value)
}

export function readRole(raw: unknown): Role | undefined {
  return named(roles, raw)
}

function readShown(raw: unknown): Shown | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) return null
  const [value, source] = raw as readonly unknown[]
  const scalar =
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.length > 0 && bytesOf(value) <= designWordBytes)
  if (!scalar) return null
  if (raw.length === 1) return [value]
  const from = named(sources, source)
  return from === undefined ? null : [value, from]
}

export function readDesign(raw: unknown): Design | null {
  const row = record(raw)
  if (row === null) return null
  const design: Partial<Record<DesignKey, Shown>> = {}
  for (const [key, value] of Object.entries(row)) {
    const known = named(designKeys, key)
    const shown = readShown(value)
    if (known === undefined || shown === null) return null
    design[known] = shown
  }
  const base = Object.fromEntries(
    baseDesignKeys.flatMap((key) => (design[key] === undefined ? [] : [[key, design[key]]])),
  )
  return bytesOf(JSON.stringify(base)) > designBytes ? null : design
}

export function readKept(raw: unknown): readonly DesignKey[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > designKeys.length) return null
  const kept: DesignKey[] = []
  for (const key of raw) {
    const known = named(designKeys, key)
    if (known === undefined || kept.includes(known)) return null
    kept.push(known)
  }
  return kept
}

const hex = /^[0-9A-F]{6}$/

export function readPalette(raw: unknown): Palette | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, row.fonts === undefined ? ["slots", "map"] : ["slots", "map", "fonts"]))
    return null
  const slots = record(row.slots)
  const map = record(row.map)
  if (slots === null || map === null) return null
  const readSlots: Partial<Record<TemplateColor, string>> = {}
  for (const [key, value] of Object.entries(slots)) {
    const slot = named(templateColors, key)
    if (slot === undefined || typeof value !== "string" || !hex.test(value)) return null
    readSlots[slot] = value
  }
  const readMap: Partial<Record<MappedSlot, TemplateColor>> = {}
  for (const [key, value] of Object.entries(map)) {
    const slot = named(mappedSlots, key)
    const target = named(templateColors, value)
    if (slot === undefined || target === undefined) return null
    readMap[slot] = target
  }
  const fonts = row.fonts === undefined ? undefined : readFonts(row.fonts)
  if (fonts === null) return null
  return { slots: readSlots, map: readMap, ...(fonts === undefined ? {} : { fonts }) }
}

function readFonts(raw: unknown): Palette["fonts"] | null {
  const row = record(raw)
  if (row === null) return null
  const fonts: Partial<Record<TemplateFont, string>> = {}
  for (const [key, value] of Object.entries(row)) {
    const font = named(templateFonts, key)
    const typeface = readTypeface(value)
    if (font === undefined || typeof typeface !== "string") return null
    fonts[font] = typeface
  }
  return fonts
}
