import type { TraitInput } from "./change.js"
import { alphaOf, fadedColor, opaque, sameColor, type Color } from "./color.js"
import type { TraitPatch } from "./row.js"
import type { Alpha } from "./value-kind.js"

declare const effectKey: unique symbol

export type EffectKey = string & { readonly [effectKey]: true }

export type Offset = {
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly color: Color
}

export type Effect =
  | ({ readonly kind: "shadow" } & Offset)
  | ({ readonly kind: "innerShadow" } & Offset)
  | { readonly kind: "glow"; readonly radius: number; readonly color: Color }
  | { readonly kind: "softEdge"; readonly radius: number }
  | { readonly kind: "blur"; readonly radius: number }

export type KeptEffect = "reflection" | "fillOverlay" | "presetShadow" | "graph"

export type Entry =
  | { readonly key: EffectKey; readonly effect: Effect }
  | { readonly key: EffectKey; readonly kept: KeptEffect }

export type ShadowPreset = "none" | "subtle" | "medium" | "strong" | "custom"

export type ResolvedEffects = {
  readonly list: readonly Entry[]
  readonly addable: readonly Effect["kind"][]
  readonly own: boolean
  readonly placeholder: boolean
  readonly slide: { readonly shadow: ShadowPreset; readonly opacity: Alpha | null }
}

export type EffectsSource = {
  readonly opening?: TraitPatch<"effects">
  readonly landed?: TraitPatch<"effects">
  readonly kept?: readonly KeptEffect[]
  readonly placeholder?: boolean
}

export type EffectsEdit =
  | { readonly add: Effect }
  | { readonly at: EffectKey; readonly effect: Effect }
  | { readonly remove: EffectKey }
  | {
      readonly slide: { readonly shadow?: Exclude<ShadowPreset, "custom">; readonly opacity?: Alpha }
    }

export type EffectsChange =
  | { readonly ok: true; readonly effects: TraitInput<"effects"> }
  | { readonly ok: false; readonly refusal: "limit" | "kept" | "placeholder" }

type EffectField = Effect["kind"]

type StackSlot = "shadow" | "drop1" | "drop2" | "drop3" | "innerShadow" | "inner1" | "inner2" | "inner3"

const order = [
  "blur",
  "fillOverlay",
  "glow",
  "innerShadow",
  "shadow",
  "presetShadow",
  "reflection",
  "softEdge",
] as const

type Place = (typeof order)[number]

const modeled: readonly EffectField[] = ["blur", "glow", "innerShadow", "shadow", "softEdge"]

const keptKinds = ["fillOverlay", "presetShadow", "reflection"] as const

const presetNames = ["subtle", "medium", "strong"] as const

const dropFields = ["shadow", "drop1", "drop2", "drop3"] as const

const innerFields = ["innerShadow", "inner1", "inner2", "inner3"] as const

const stackCap = 4

function black(alphaValue: number): Color {
  return { rgb: "000000", transforms: [{ op: "alpha", val: alphaValue }] }
}

const presets: Readonly<Record<(typeof presetNames)[number], Offset>> = {
  subtle: { blur: 25_400, distance: 12_700, direction: 2_700_000, color: black(15_000) },
  medium: { blur: 50_800, distance: 25_400, direction: 2_700_000, color: black(25_000) },
  strong: { blur: 101_600, distance: 50_800, direction: 2_700_000, color: black(35_000) },
}

function effectKeyOf(name: string): EffectKey {
  return name as EffectKey
}

function alpha(value: number): Alpha {
  return value as Alpha
}

function owns(landed: TraitPatch<"effects"> | undefined): boolean {
  if (landed === undefined) return false
  return Object.values(landed).some((edit) => edit !== undefined && edit !== "opening")
}

function winning(source: EffectsSource, field: StackSlot | EffectField): unknown {
  const landed = source.landed?.[field]
  if (landed === "inherit") return undefined
  const opening = source.opening?.[field]
  if (landed !== undefined && landed !== "opening") return landed.set
  if (opening !== undefined && opening !== "opening" && opening !== "inherit") return opening.set
  return undefined
}

function offsetOf(value: unknown): Offset | null {
  if (typeof value !== "object" || value === null) return null
  if (!("blur" in value) || !("distance" in value) || !("direction" in value) || !("color" in value)) return null
  const { blur, distance, direction, color } = value
  if (typeof blur !== "number" || typeof distance !== "number" || typeof direction !== "number") return null
  if (typeof color !== "object" || color === null) return null
  return { blur, distance, direction, color: color as Color }
}

function asEffect(kind: EffectField, value: unknown): Effect | null {
  if (typeof value !== "object" || value === null || "none" in value) return null
  if (kind === "shadow" && "outer" in value) {
    const outer = offsetOf(value.outer)
    return outer === null ? null : { kind, ...outer }
  }
  if (kind === "innerShadow" && "inner" in value) {
    const inner = offsetOf(value.inner)
    return inner === null ? null : { kind, ...inner }
  }
  if (kind === "glow" && "halo" in value) {
    const halo = value.halo
    if (typeof halo !== "object" || halo === null || !("radius" in halo) || !("color" in halo)) return null
    if (typeof halo.radius !== "number" || typeof halo.color !== "object" || halo.color === null) return null
    return { kind, radius: halo.radius, color: halo.color as Color }
  }
  if ((kind === "softEdge" || kind === "blur") && "radius" in value && typeof value.radius === "number")
    return { kind, radius: value.radius }
  return null
}

function slotOf(key: string): string {
  if (key.startsWith("shadow.")) return `drop${key.slice("shadow.".length)}`
  if (key.startsWith("innerShadow.")) return `inner${key.slice("innerShadow.".length)}`
  return key
}

function keyFor(slot: string): EffectKey {
  if (slot.startsWith("drop")) return effectKeyOf(`shadow.${slot.slice("drop".length)}`)
  if (slot.startsWith("inner") && slot !== "innerShadow")
    return effectKeyOf(`innerShadow.${slot.slice("inner".length)}`)
  return effectKeyOf(slot)
}

function placeOf(entry: Entry): Place {
  if ("effect" in entry) return entry.effect.kind
  if (entry.kept === "presetShadow") return "shadow"
  if (entry.kept === "graph") return "blur"
  return entry.kept
}

function slotIndex(entry: Entry): number {
  if (!("effect" in entry)) return 0
  const key = entry.key
  const extra = key.startsWith("shadow.")
    ? Number(key.slice("shadow.".length))
    : key.startsWith("innerShadow.")
      ? Number(key.slice("innerShadow.".length))
      : 0
  return Number.isFinite(extra) ? extra : 0
}

function rank(entry: Entry): number {
  return order.indexOf(placeOf(entry)) * 10 + slotIndex(entry)
}

function sameStrength(outer: Offset, expected: Offset): boolean {
  return (
    outer.blur === expected.blur &&
    outer.distance === expected.distance &&
    outer.direction === expected.direction &&
    sameColor(fadedColor(outer.color, opaque), fadedColor(expected.color, opaque))
  )
}

function countOf(list: readonly Entry[], kind: "shadow" | "innerShadow"): number {
  return list.filter((entry) => "effect" in entry && entry.effect.kind === kind).length
}

function slideOf(effect: Extract<Effect, { kind: "shadow" }> | null, extra: boolean): ResolvedEffects["slide"] {
  if (extra) return { shadow: "custom", opacity: null }
  if (effect === null) return { shadow: "none", opacity: null }
  const named = presetNames.find((name) => sameStrength(effect, presets[name]))
  return named === undefined
    ? { shadow: "custom", opacity: null }
    : { shadow: named, opacity: alpha(alphaOf(effect.color)) }
}

function keptEntries(kept: readonly KeptEffect[]): Entry[] {
  if (kept.includes("graph")) return [{ key: effectKeyOf("graph"), kept: "graph" }]
  return keptKinds.flatMap((kind) => (kept.includes(kind) ? [{ key: effectKeyOf(kind), kept: kind }] : []))
}

function addableOf(list: readonly Entry[], placeholder: boolean): EffectField[] {
  if (list.some((entry) => "kept" in entry && entry.kept === "graph")) return []
  const taken = new Set(list.map(placeOf))
  const shadows = countOf(list, "shadow")
  const inners = countOf(list, "innerShadow")
  return modeled.filter((kind) => {
    if (kind === "shadow") {
      if (taken.has("shadow") && shadows === 0) return false
      return shadows < (placeholder ? 1 : stackCap)
    }
    if (kind === "innerShadow") return inners < stackCap
    return !taken.has(kind)
  })
}

function fitsPowerPoint(list: readonly Entry[]): boolean {
  if (list.some((entry) => "kept" in entry && entry.kept === "graph")) return list.length === 1
  let previous = -1
  let shadowBlocked = false
  let shadows = 0
  let inners = 0
  for (const entry of list) {
    const place = placeOf(entry)
    const at = order.indexOf(place)
    if (at < previous) return false
    if (at === previous && place !== "shadow" && place !== "innerShadow") return false
    previous = at
    if (place === "shadow" && "kept" in entry) {
      if (shadows > 0) return false
      shadowBlocked = true
    }
    if (place === "shadow" && "effect" in entry) {
      if (shadowBlocked) return false
      shadows += 1
      if (shadows > stackCap) return false
    }
    if (place === "innerShadow" && "effect" in entry) {
      inners += 1
      if (inners > stackCap) return false
    }
  }
  return true
}

function slotsOf(
  source: EffectsSource,
  kind: EffectField,
  fields: readonly string[],
): { readonly key: EffectKey; readonly effect: Effect }[] {
  return fields.flatMap((field) => {
    const effect = asEffect(kind, winning(source, field as StackSlot | EffectField))
    return effect === null ? [] : [{ key: keyFor(field), effect }]
  })
}

export function readEffects(source: EffectsSource): ResolvedEffects {
  const placeholder = source.placeholder === true
  const kept = keptEntries(source.kept ?? [])
  if (kept.some((entry) => "kept" in entry && entry.kept === "graph"))
    return { list: kept, addable: [], own: owns(source.landed), placeholder, slide: { shadow: "none", opacity: null } }
  const present = [
    ...slotsOf(source, "blur", ["blur"]),
    ...slotsOf(source, "glow", ["glow"]),
    ...slotsOf(source, "innerShadow", innerFields),
    ...slotsOf(source, "shadow", dropFields),
    ...slotsOf(source, "softEdge", ["softEdge"]),
  ]
  const list = [...present, ...kept].sort((left, right) => rank(left) - rank(right))
  const shadow = present.find((entry) => entry.effect.kind === "shadow" && entry.key === "shadow")
  const extra = present.some((entry) => entry.effect.kind === "shadow" && entry.key !== "shadow")
  return {
    list,
    addable: addableOf(list, placeholder),
    own: owns(source.landed),
    placeholder,
    slide: slideOf(shadow?.effect.kind === "shadow" ? shadow.effect : null, extra),
  }
}

function shadowInput(slot: (typeof dropFields)[number], effect: Offset): TraitInput<"effects"> {
  const outer = { blur: effect.blur, distance: effect.distance, direction: effect.direction, color: effect.color }
  if (slot === "shadow") return { shadow: { outer } }
  if (slot === "drop1") return { drop1: { outer } }
  if (slot === "drop2") return { drop2: { outer } }
  return { drop3: { outer } }
}

function innerInput(slot: (typeof innerFields)[number], effect: Offset): TraitInput<"effects"> {
  const inner = { blur: effect.blur, distance: effect.distance, direction: effect.direction, color: effect.color }
  if (slot === "innerShadow") return { innerShadow: { inner } }
  if (slot === "inner1") return { inner1: { inner } }
  if (slot === "inner2") return { inner2: { inner } }
  return { inner3: { inner } }
}

function writtenAt(slot: string, effect: Effect): TraitInput<"effects"> {
  if (effect.kind === "shadow") return shadowInput(slot as (typeof dropFields)[number], effect)
  if (effect.kind === "innerShadow") return innerInput(slot as (typeof innerFields)[number], effect)
  if (effect.kind === "glow") return { glow: { halo: { radius: effect.radius, color: effect.color } } }
  if (effect.kind === "softEdge") return { softEdge: { radius: effect.radius } }
  return { blur: { radius: effect.radius } }
}

function clearedAt(slot: string): TraitInput<"effects"> {
  if (slot === "shadow") return { shadow: { none: true } }
  if (slot === "drop1") return { drop1: { none: true } }
  if (slot === "drop2") return { drop2: { none: true } }
  if (slot === "drop3") return { drop3: { none: true } }
  if (slot === "innerShadow") return { innerShadow: { none: true } }
  if (slot === "inner1") return { inner1: { none: true } }
  if (slot === "inner2") return { inner2: { none: true } }
  if (slot === "inner3") return { inner3: { none: true } }
  if (slot === "glow") return { glow: { none: true } }
  if (slot === "softEdge") return { softEdge: { none: true } }
  return { blur: { none: true } }
}

function shadowOf(current: ResolvedEffects): Offset | null {
  const entry = current.list.find((each) => "effect" in each && each.key === "shadow")
  if (entry === undefined || !("effect" in entry) || entry.effect.kind !== "shadow") return null
  const { blur, distance, direction, color } = entry.effect
  return { blur, distance, direction, color }
}

function clamped(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(opaque, Math.round(value)))
}

function replaced(current: ResolvedEffects, outer: Offset | null): Entry[] {
  const rest = current.list.filter((entry) => !("effect" in entry && entry.effect.kind === "shadow"))
  if (outer === null) return rest
  return [...rest, { key: effectKeyOf("shadow"), effect: { kind: "shadow" as const, ...outer } }].sort(
    (left, right) => rank(left) - rank(right),
  )
}

function nextSlot(current: ResolvedEffects, kind: "shadow" | "innerShadow"): string | undefined {
  const fields = kind === "shadow" ? dropFields : innerFields
  const used = new Set(
    current.list.flatMap((entry) => ("effect" in entry && entry.effect.kind === kind ? [slotOf(entry.key)] : [])),
  )
  return fields.find((field) => !used.has(field))
}

function slideChange(
  current: ResolvedEffects,
  slide: { readonly shadow?: Exclude<ShadowPreset, "custom">; readonly opacity?: Alpha },
): EffectsChange {
  if (slide.shadow === undefined && slide.opacity === undefined) return { ok: true, effects: {} }
  let outer = shadowOf(current)
  if (slide.shadow === "none") {
    if (slide.opacity !== undefined) return { ok: false, refusal: "limit" }
    outer = null
  } else if (slide.shadow !== undefined) outer = presets[slide.shadow]
  if (slide.opacity !== undefined) {
    if (outer === null) return { ok: false, refusal: "limit" }
    outer = { ...outer, color: fadedColor(outer.color, clamped(slide.opacity)) }
  }
  const next = replaced(current, outer)
  if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
  if (outer === null) return { ok: true, effects: clearedAt("shadow") }
  return { ok: true, effects: writtenAt("shadow", { kind: "shadow", ...outer }) }
}

export function changeEffects(current: ResolvedEffects, edit: EffectsEdit): EffectsChange {
  if (current.list.some((entry) => "kept" in entry && entry.kept === "graph")) return { ok: false, refusal: "kept" }
  if ("slide" in edit) return slideChange(current, edit.slide)
  if ("remove" in edit) {
    const entry = current.list.find((each) => each.key === edit.remove)
    if (entry === undefined) return { ok: false, refusal: "limit" }
    if ("kept" in entry) return { ok: false, refusal: "kept" }
    const next = current.list.filter((each) => each.key !== edit.remove)
    if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
    return { ok: true, effects: clearedAt(slotOf(entry.key)) }
  }
  if ("at" in edit) {
    const entry = current.list.find((each) => each.key === edit.at)
    if (entry === undefined) return { ok: false, refusal: "limit" }
    if ("kept" in entry) return { ok: false, refusal: "kept" }
    if (edit.effect.kind !== entry.effect.kind) return { ok: false, refusal: "limit" }
    const next = current.list.map((each) => (each.key === edit.at ? { key: each.key, effect: edit.effect } : each))
    if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
    return { ok: true, effects: writtenAt(slotOf(entry.key), edit.effect) }
  }
  if (edit.add.kind === "shadow" && current.placeholder && countOf(current.list, "shadow") >= 1)
    return { ok: false, refusal: "placeholder" }
  if (!current.addable.includes(edit.add.kind)) return { ok: false, refusal: "limit" }
  const slot =
    edit.add.kind === "shadow" || edit.add.kind === "innerShadow" ? nextSlot(current, edit.add.kind) : edit.add.kind
  if (slot === undefined) return { ok: false, refusal: "limit" }
  const next = [...current.list, { key: keyFor(slot), effect: edit.add }].sort(
    (left, right) => rank(left) - rank(right),
  )
  if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
  return { ok: true, effects: writtenAt(slot, edit.add) }
}
