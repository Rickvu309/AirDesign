import { dropSlots, innerSlots } from "./trait-effects.js"
import { type MappedSlot, type TemplateColor } from "./color.js"

export const roles = ["title", "subtitle", "body", "date", "footer", "number", "picture", "chart", "object"] as const
export type Role = (typeof roles)[number]

export const sources = ["layout", "master", "style"] as const
export type Source = (typeof sources)[number]

export const shadowSlotKeys = [
  ...dropSlots.map((slot) => `effects.${slot}` as const),
  ...innerSlots.map((slot) => `effects.${slot}` as const),
] as const

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
  "fills.color",
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

export type Shown = readonly [value: string | number | boolean, source?: Source]
export type Design = { readonly [Key in DesignKey]?: Shown }

export const templateFonts = ["major", "minor"] as const
export type TemplateFont = (typeof templateFonts)[number]

export type Palette = {
  readonly slots: { readonly [Slot in TemplateColor]?: string }
  readonly map: { readonly [Slot in MappedSlot]?: TemplateColor }
  readonly fonts?: { readonly [Font in TemplateFont]?: string }
}

export type Read<Value> = { readonly value: Value; readonly source?: Source }
