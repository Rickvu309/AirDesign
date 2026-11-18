import type { ElementLink } from "./link-target.js"
import { mappedSlots, themeSlots, type Color, type MappedSlot, type ThemeSlot } from "./color.js"
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

export const designKeys = [
  "geometry",
  "fills",
  "line.width",
  "line.fill",
  "line.dash",
  "line.head",
  "line.tail",
  "effects.shadow",
  "effects.glow",
  "effects.softEdge",
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
  "fills.recolor",
  "fills.crop",
  "identity.alt",
  "identity.hidden",
  "connection.start",
  "connection.end",
] as const
export type DesignKey = (typeof designKeys)[number]

const firstKeys: readonly DesignKey[] = ["box.rot", "box.flipH", "box.flipV", "connection.start", "connection.end"]

export const designOrder: readonly DesignKey[] = [...firstKeys, ...designKeys.filter((key) => !firstKeys.includes(key))]

export type Shown = readonly [value: string | number | boolean, source?: Source]
export type Design = { readonly [Key in DesignKey]?: Shown }

export const designBytes = 400
const wordBytes = 200

export const themeFonts = ["major", "minor"] as const
export type ThemeFont = (typeof themeFonts)[number]

export type Palette = {
  readonly slots: { readonly [Slot in ThemeSlot]?: string }
  readonly map: { readonly [Slot in MappedSlot]?: ThemeSlot }
  readonly fonts?: { readonly [Font in ThemeFont]?: string }
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
export type TraitReads = {
  readonly geometry?: Read<string>
  readonly fills?: Read<FillRead>
  readonly "line.width"?: Read<number>
  readonly "line.fill"?: Read<FillRead>
  readonly "line.dash"?: Read<string>
  readonly "line.head"?: Read<string>
  readonly "line.tail"?: Read<string>
  readonly "effects.shadow"?: Read<ShadowRead>
  readonly "effects.glow"?: Read<GlowRead>
  readonly "effects.softEdge"?: Read<number>
  readonly "text.size"?: Read<number>
  readonly "text.color"?: Read<Color>
  readonly "text.font"?: Read<string> & { readonly theme?: ThemeFont }
  readonly "text.bold"?: Read<boolean>
  readonly "body.anchor"?: Read<string>
  readonly "body.autofit"?: Read<string>
  readonly "body.vertical"?: Read<string>
  readonly "box.rot"?: Read<number>
  readonly "box.flipH"?: Read<boolean>
  readonly "box.flipV"?: Read<boolean>
  readonly "fills.source"?: Read<string>
  readonly "fills.recolor"?: Read<RecolorRead>
  readonly "fills.crop"?: Read<CropRead>
  readonly "identity.alt"?: Read<string>
  readonly "identity.hidden"?: Read<boolean>
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
    (typeof value === "string" && value.length > 0 && bytesOf(value) <= wordBytes)
  if (!scalar) return null
  if (raw.length === 1) return [value]
  const from = named(sources, source)
  return from === undefined ? null : [value, from]
}

export function readDesign(raw: unknown): Design | null {
  const row = record(raw)
  if (row === null || bytesOf(JSON.stringify(row)) > designBytes) return null
  const design: Partial<Record<DesignKey, Shown>> = {}
  for (const [key, value] of Object.entries(row)) {
    const known = named(designKeys, key)
    const shown = readShown(value)
    if (known === undefined || shown === null) return null
    design[known] = shown
  }
  return design
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
  const readSlots: Partial<Record<ThemeSlot, string>> = {}
  for (const [key, value] of Object.entries(slots)) {
    const slot = named(themeSlots, key)
    if (slot === undefined || typeof value !== "string" || !hex.test(value)) return null
    readSlots[slot] = value
  }
  const readMap: Partial<Record<MappedSlot, ThemeSlot>> = {}
  for (const [key, value] of Object.entries(map)) {
    const slot = named(mappedSlots, key)
    const target = named(themeSlots, value)
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
  const fonts: Partial<Record<ThemeFont, string>> = {}
  for (const [key, value] of Object.entries(row)) {
    const font = named(themeFonts, key)
    const typeface = readTypeface(value)
    if (font === undefined || typeof typeface !== "string") return null
    fonts[font] = typeface
  }
  return fonts
}
