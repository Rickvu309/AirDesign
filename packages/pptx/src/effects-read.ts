import { widestEffect, type Color, type FieldName, type FieldValue } from "@airdesign/document"
import { colorIn } from "./color-read.js"
import type { MarkupElement } from "./element-span.js"
import { placedBytes } from "./fill-read.js"
import { child, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import type { Sheet } from "./paint-sheet.js"
import { ownersOf, propertiesOf, sheetOf, stylesOf, type Chain } from "./trait-read.js"

export type EffectsField = FieldName<"effects">

export type ShownEffects = {
  readonly [F in EffectsField]: { readonly value: FieldValue<"effects", F> | null; readonly own: boolean }
}

export type EffectsAt = { readonly part: string; readonly shape: string }

export type EffectsSlot = {
  readonly list: Held | undefined
  readonly dag: boolean
  readonly own: boolean
  readonly placed: Color | null
  readonly bytes: () => Uint8Array | null
}

const colorKinds = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])
const fullAngle = 21_600_000

function sheetFor(chain: Chain, held: Held): Sheet | null {
  if (held.source === "layout") return chain.layout
  if (held.source === "master") return chain.master
  return chain.sheet
}

function sliceOf(sheet: Sheet | null, element: MarkupElement): Uint8Array | null {
  return sheet === null ? null : sheet.bytes.subarray(element.start, element.end)
}

const none: EffectsSlot = { list: undefined, dag: false, own: false, placed: null, bytes: () => null }

function listOf(holder: Held | undefined): { readonly list: Held | undefined; readonly dag: boolean } | null {
  const list = child(holder, "a:effectLst")
  if (list !== undefined) return { list, dag: false }
  return child(holder, "a:effectDag") === undefined ? null : { list: undefined, dag: true }
}

function styleSlot(owners: readonly Held[], chain: Chain): EffectsSlot {
  for (const owner of owners) {
    const reference = child(child(owner, "p:style"), "a:effectRef")
    if (reference === undefined) continue
    const index = whole(reference.element, "idx") ?? 0
    const entry = index < 1 ? undefined : stylesOf(chain.theme).effects[index - 1]
    const found = listOf(entry)
    if (entry === undefined || found === null) return none
    const placed = colorIn(reference, null)
    const color = inside(reference).find((each) => colorKinds.has(each.kind))
    return {
      ...found,
      own: false,
      placed,
      bytes: () => {
        const list = found.list === undefined ? null : sliceOf(chain.theme, found.list.element)
        const colorBytes = color === undefined ? null : sliceOf(sheetFor(chain, owner), color)
        return list === null ? null : placedBytes(list, colorBytes)
      },
    }
  }
  return none
}

export function effectsSlot(parts: ReadonlyMap<string, Uint8Array>, at: EffectsAt): EffectsSlot | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const theme = master === null ? null : sheetOf(parts, linkedPart(parts, master.part, "theme"))
  const chain = { sheet, layout, master, theme }
  const owners = ownersOf(item, chain)
  for (const [index, owner] of owners.entries()) {
    const found = listOf(propertiesOf(owner))
    if (found === null) continue
    return {
      ...found,
      own: index === 0,
      placed: null,
      bytes: () => (found.list === undefined ? null : sliceOf(sheetFor(chain, owner), found.list.element)),
    }
  }
  return styleSlot(owners, chain)
}

function radius(element: MarkupElement, name: string): number | null {
  if (paintAttribute(element, name) === null) return 0
  const value = whole(element, name)
  return value === undefined || value < 0 || value > widestEffect ? null : value
}

function shadowOf(list: Held, placed: Color | null): FieldValue<"effects", "shadow"> | null {
  const shadow = child(list, "a:outerShdw")
  if (shadow === undefined) return { none: true }
  const blur = radius(shadow.element, "blurRad")
  const distance = radius(shadow.element, "dist")
  const direction = paintAttribute(shadow.element, "dir") === null ? 0 : whole(shadow.element, "dir")
  const color = colorIn(shadow, placed)
  if (blur === null || distance === null || direction === undefined || color === null) return null
  if (direction < 0 || direction >= fullAngle) return null
  return { outer: { blur, distance, direction, color } }
}

function glowOf(list: Held, placed: Color | null): FieldValue<"effects", "glow"> | null {
  const glow = child(list, "a:glow")
  if (glow === undefined) return { none: true }
  const size = radius(glow.element, "rad")
  const color = colorIn(glow, placed)
  return size === null || color === null ? null : { halo: { radius: size, color } }
}

function softEdgeOf(list: Held): FieldValue<"effects", "softEdge"> | null {
  const soft = child(list, "a:softEdge")
  if (soft === undefined) return { none: true }
  const size = radius(soft.element, "rad")
  return size === null ? null : { radius: size }
}

export function shownEffects(parts: ReadonlyMap<string, Uint8Array>, at: EffectsAt): ShownEffects | null {
  const slot = effectsSlot(parts, at)
  if (slot === null) return null
  const { list, dag, own, placed } = slot
  if (dag) return { shadow: { value: null, own }, glow: { value: null, own }, softEdge: { value: null, own } }
  if (list === undefined) {
    return {
      shadow: { value: { none: true }, own },
      glow: { value: { none: true }, own },
      softEdge: { value: { none: true }, own },
    }
  }
  return {
    shadow: { value: shadowOf(list, placed), own },
    glow: { value: glowOf(list, placed), own },
    softEdge: { value: softEdgeOf(list), own },
  }
}
