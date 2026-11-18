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
  readonly slide: { readonly shadow: ShadowPreset; readonly opacity: Alpha | null }
}

export type EffectsSource = {
  readonly opening?: TraitPatch<"effects">
  readonly landed?: TraitPatch<"effects">
  readonly kept?: readonly KeptEffect[]
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
  | { readonly ok: false; readonly refusal: "limit" | "kept" }

type EffectField = Effect["kind"]

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

function winning(source: EffectsSource, field: EffectField): unknown {
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

function placeOf(entry: Entry): Place {
  if ("effect" in entry) return entry.effect.kind
  if (entry.kept === "presetShadow") return "shadow"
  if (entry.kept === "graph") return "blur"
  return entry.kept
}

function rank(entry: Entry): number {
  if ("effect" in entry) return order.indexOf(entry.effect.kind)
  return order.indexOf(entry.kept === "graph" ? "blur" : entry.kept)
}

function sameStrength(outer: Offset, expected: Offset): boolean {
  return (
    outer.blur === expected.blur &&
    outer.distance === expected.distance &&
    outer.direction === expected.direction &&
    sameColor(fadedColor(outer.color, opaque), fadedColor(expected.color, opaque))
  )
}

function slideOf(effect: Extract<Effect, { kind: "shadow" }> | null): ResolvedEffects["slide"] {
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

function addableOf(list: readonly Entry[]): EffectField[] {
  if (list.some((entry) => "kept" in entry && entry.kept === "graph")) return []
  const taken = new Set(list.map(placeOf))
  return modeled.filter((kind) => !taken.has(kind))
}

function fitsPowerPoint(list: readonly Entry[]): boolean {
  if (list.some((entry) => "kept" in entry && entry.kept === "graph")) return list.length === 1
  const places = list.map(placeOf)
  if (new Set(places).size !== places.length) return false
  for (let at = 1; at < places.length; at += 1) {
    const previous = places[at - 1]
    const place = places[at]
    if (previous === undefined || place === undefined || order.indexOf(previous) >= order.indexOf(place)) return false
  }
  return true
}

export function readEffects(source: EffectsSource): ResolvedEffects {
  const kept = keptEntries(source.kept ?? [])
  if (kept.some((entry) => "kept" in entry && entry.kept === "graph"))
    return { list: kept, addable: [], own: owns(source.landed), slide: { shadow: "none", opacity: null } }
  const present = modeled.flatMap((kind) => {
    const effect = asEffect(kind, winning(source, kind))
    return effect === null ? [] : [{ key: effectKeyOf(kind), effect }]
  })
  const list = [...present, ...kept].sort((left, right) => rank(left) - rank(right))
  const shadow = present.find((entry) => entry.effect.kind === "shadow")
  return {
    list,
    addable: addableOf(list),
    own: owns(source.landed),
    slide: slideOf(shadow?.effect.kind === "shadow" ? shadow.effect : null),
  }
}

function written(effect: Effect): TraitInput<"effects"> {
  if (effect.kind === "shadow") {
    const { blur, distance, direction, color } = effect
    return { shadow: { outer: { blur, distance, direction, color } } }
  }
  if (effect.kind === "innerShadow") {
    const { blur, distance, direction, color } = effect
    return { innerShadow: { inner: { blur, distance, direction, color } } }
  }
  if (effect.kind === "glow") return { glow: { halo: { radius: effect.radius, color: effect.color } } }
  if (effect.kind === "softEdge") return { softEdge: { radius: effect.radius } }
  return { blur: { radius: effect.radius } }
}

function cleared(kind: EffectField): TraitInput<"effects"> {
  if (kind === "shadow") return { shadow: { none: true } }
  if (kind === "innerShadow") return { innerShadow: { none: true } }
  if (kind === "glow") return { glow: { none: true } }
  if (kind === "softEdge") return { softEdge: { none: true } }
  return { blur: { none: true } }
}

function shadowOf(current: ResolvedEffects): Offset | null {
  const entry = current.list.find((each) => "effect" in each && each.effect.kind === "shadow")
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
  if (outer === null) return { ok: true, effects: cleared("shadow") }
  return { ok: true, effects: written({ kind: "shadow", ...outer }) }
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
    return { ok: true, effects: cleared(entry.effect.kind) }
  }
  if ("at" in edit) {
    const entry = current.list.find((each) => each.key === edit.at)
    if (entry === undefined) return { ok: false, refusal: "limit" }
    if ("kept" in entry) return { ok: false, refusal: "kept" }
    if (edit.effect.kind !== entry.effect.kind) return { ok: false, refusal: "limit" }
    const next = current.list.map((each) => (each.key === edit.at ? { key: each.key, effect: edit.effect } : each))
    if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
    return { ok: true, effects: written(edit.effect) }
  }
  if (!current.addable.includes(edit.add.kind)) return { ok: false, refusal: "limit" }
  const next = [...current.list, { key: effectKeyOf(edit.add.kind), effect: edit.add }].sort(
    (left, right) => rank(left) - rank(right),
  )
  if (!fitsPowerPoint(next)) return { ok: false, refusal: "limit" }
  return { ok: true, effects: written(edit.add) }
}
