import {
  changeEffects,
  readEffects,
  type Color,
  type Effect,
  type EffectKey,
  type EffectsSource,
  type Entry,
  type KeptEffect,
  type ResolvedEffects,
  type ScopedElement,
  type SetChange,
  type TraitPatch,
} from "@airdesign/document"
import { Minus } from "lucide-react"
import { effectsCopy } from "@/copy/effects-copy"
import { resolveControl } from "./panel-arrangement"
import type { PanelControl, PanelReads, PanelSection } from "./panel"

const kindNames = ["blur", "glow", "innerShadow", "shadow", "softEdge"] as const

const slotNames = ["drop1", "drop2", "drop3", "inner1", "inner2", "inner3"] as const

const placeholderRoles = new Set(["title", "ctrTitle", "body"])

type KindName = (typeof kindNames)[number]

type SlotName = (typeof slotNames)[number]

const keptNames = ["reflection", "fillOverlay", "presetShadow", "graph"] as const

const seen = { op: "alpha", val: 40_000 } as const

function isKind(field: string): field is KindName {
  return (kindNames as readonly string[]).includes(field)
}

function isKept(name: string): name is KeptEffect {
  return (keptNames as readonly string[]).includes(name)
}

function effectKey(name: string): EffectKey {
  return name as EffectKey
}

function liveValue(kind: KindName, value: unknown): boolean {
  if (typeof value !== "object" || value === null || "none" in value) return false
  if (kind === "shadow") return "outer" in value
  if (kind === "innerShadow") return "inner" in value
  if (kind === "glow") return "halo" in value
  return "radius" in value && typeof value.radius === "number"
}

function offsetOf(
  value: unknown,
): Pick<Extract<Effect, { kind: "shadow" }>, "blur" | "distance" | "direction" | "color"> | null {
  if (typeof value !== "object" || value === null) return null
  if (!("blur" in value) || !("distance" in value) || !("direction" in value) || !("color" in value)) return null
  const { blur, distance, direction, color } = value
  if (typeof blur !== "number" || typeof distance !== "number" || typeof direction !== "number") return null
  if (typeof color !== "object" || color === null) return null
  return { blur, distance, direction, color: color as Color }
}

function effectFrom(kind: KindName, value: unknown): Effect | null {
  if (!liveValue(kind, value) || typeof value !== "object" || value === null) return null
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

function cleared(value: unknown): boolean {
  return typeof value === "object" && value !== null && "none" in value
}

function liveSlot(slot: SlotName, value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  return slot.startsWith("drop") ? "outer" in value : "inner" in value
}

function sourceOf(controls: readonly PanelControl[], shown: PanelReads): EffectsSource {
  const landed: Record<string, { set: unknown }> = {}
  const opening: Record<string, { set: unknown }> = {}
  for (const control of controls) {
    if (!isKind(control.field) || !liveValue(control.field, control.value)) continue
    const slot = { set: control.value }
    if (control.inherited) opening[control.field] = slot
    else landed[control.field] = slot
  }
  for (const slot of slotNames) {
    const field = shown.fields?.[`effects.${slot}`]
    if (field === undefined || !liveSlot(slot, field.value)) continue
    const placed = { set: field.value }
    if (field.own) landed[slot] = placed
    else opening[slot] = placed
  }
  return {
    ...(Object.keys(landed).length === 0 ? {} : { landed: landed as TraitPatch<"effects"> }),
    ...(Object.keys(opening).length === 0 ? {} : { opening: opening as TraitPatch<"effects"> }),
    ...(shown.role !== undefined && placeholderRoles.has(shown.role) ? { placeholder: true } : {}),
  }
}

function keptList(shown: PanelReads, view: ScopedElement): readonly KeptEffect[] {
  const text = shown.fields?.["effects.kept"]?.value
  const named = typeof text !== "string" ? [] : text.split(" ").flatMap((name) => (isKept(name) ? [name] : []))
  const modeled = ["effects.blur", "effects.glow", "effects.innerShadow", "effects.shadow", "effects.softEdge"] as const
  if (named.includes("graph") || modeled.every((key) => view.kept.includes(key))) return ["graph"]
  return named
}

function targetOf(view: ScopedElement): SetChange {
  return { target: { node: view.node } }
}

function written(view: ScopedElement, read: ResolvedEffects, edit: Parameters<typeof changeEffects>[1]): SetChange {
  const pick = changeEffects(read, edit)
  return pick.ok ? { target: { node: view.node }, effects: pick.effects } : targetOf(view)
}

function bound(control: PanelControl, read: ResolvedEffects, view: ScopedElement): PanelControl {
  const kind = control.field
  if (!isKind(kind)) return control
  return {
    ...control,
    change: (value) => {
      if (cleared(value)) return written(view, read, { remove: effectKey(kind) })
      const effect = effectFrom(kind, value)
      if (effect === null) return targetOf(view)
      const present = read.list.some((entry) => "effect" in entry && entry.effect.kind === kind)
      return written(view, read, present ? { at: effectKey(kind), effect } : { add: effect })
    },
  }
}

function starter(kind: KindName): Effect {
  if (kind === "shadow" || kind === "innerShadow")
    return {
      kind,
      blur: 50_800,
      distance: 38_100,
      direction: 2_700_000,
      color: { rgb: "000000", transforms: [seen] },
    }
  if (kind === "glow") return { kind, radius: 63_500, color: { scheme: "accent1", transforms: [seen] } }
  return { kind, radius: 63_500 }
}

function stored(effect: Effect): unknown {
  if (effect.kind === "shadow") {
    const { blur, distance, direction, color } = effect
    return { outer: { blur, distance, direction, color } }
  }
  if (effect.kind === "innerShadow") {
    const { blur, distance, direction, color } = effect
    return { inner: { blur, distance, direction, color } }
  }
  if (effect.kind === "glow") return { halo: { radius: effect.radius, color: effect.color } }
  return { radius: effect.radius }
}

function boundEntry(
  control: PanelControl,
  entry: Extract<Entry, { effect: Effect }>,
  read: ResolvedEffects,
  view: ScopedElement,
): PanelControl {
  return {
    ...control,
    value: stored(entry.effect),
    inherited: false,
    change: (value) => {
      if (cleared(value)) return written(view, read, { remove: entry.key })
      const effect = effectFrom(entry.effect.kind, value)
      if (effect === null) return targetOf(view)
      return written(view, read, { at: entry.key, effect })
    },
  }
}

function removeControl(key: EffectKey, label: string, read: ResolvedEffects, view: ScopedElement): PanelControl {
  return {
    trait: "effects",
    field: `remove.${key}`,
    label,
    kind: "action",
    look: { name: { show: "hidden" }, options: { remove: Minus }, form: "segments" },
    desc: { kind: "choice", options: ["remove"] },
    value: undefined,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => written(view, read, { remove: key }),
  }
}

function placeholderNote(view: ScopedElement): PanelControl {
  return {
    trait: "effects",
    field: "placeholder",
    label: effectsCopy.placeholder,
    kind: "text",
    look: { name: { show: "above" }, options: {}, form: "segments" },
    desc: { kind: "words", max: 180 },
    value: effectsCopy.placeholder,
    mixed: false,
    inherited: false,
    reset: null,
    change: () => targetOf(view),
  }
}

function keptControl(kind: KeptEffect, view: ScopedElement): PanelControl {
  return {
    trait: "effects",
    field: `kept.${kind}`,
    label: effectsCopy[kind],
    kind: "text",
    look: { name: { show: "above" }, options: {}, form: "segments" },
    desc: { kind: "words", max: 40 },
    value: effectsCopy[kind],
    mixed: false,
    inherited: false,
    reset: null,
    change: () => targetOf(view),
  }
}

function addControl(read: ResolvedEffects, view: ScopedElement): PanelControl {
  return resolveControl({
    trait: "effects",
    field: "add",
    label: effectsCopy.add,
    desc: { kind: "choice", options: read.addable },
    value: undefined,
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => {
      if (typeof value !== "string" || !isKind(value)) return targetOf(view)
      return written(view, read, { add: starter(value) })
    },
  })
}

function keptEntry(entry: Entry): entry is Extract<Entry, { kept: KeptEffect }> {
  return "kept" in entry
}

function rows(
  controls: readonly PanelControl[],
  read: ResolvedEffects,
  view: ScopedElement,
): readonly (readonly PanelControl[])[] {
  const byField = new Map(
    controls.flatMap((control) => (isKind(control.field) ? [[control.field, control] as const] : [])),
  )
  const present = new Set(read.list.flatMap((entry) => (keptEntry(entry) ? [] : [entry.effect.kind])))
  const shownRows = read.list.flatMap((entry): (readonly PanelControl[])[] => {
    if (keptEntry(entry)) return [[keptControl(entry.kept, view)]]
    const control = byField.get(entry.effect.kind)
    return control === undefined
      ? []
      : [[boundEntry(control, entry, read, view), removeControl(entry.key, effectsCopy[entry.effect.kind], read, view)]]
  })
  const absent = kindNames.flatMap((kind) => {
    if (present.has(kind)) return []
    const control = byField.get(kind)
    return control === undefined ? [] : [[bound(control, read, view)]]
  })
  const note =
    read.placeholder && read.list.some((entry) => "effect" in entry && entry.effect.kind === "shadow")
      ? [[placeholderNote(view)]]
      : []
  return [...note, ...shownRows, ...absent, [addControl(read, view)]]
}

export function listEffects(
  sections: readonly PanelSection[],
  view: ScopedElement,
  shown: PanelReads,
): readonly PanelSection[] {
  const effects = sections.find((section) => section.trait === "effects")
  const controls = effects?.strips.flat() ?? []
  const kept = keptList(shown, view)
  const read = readEffects({ ...sourceOf(controls, shown), ...(kept.length === 0 ? {} : { kept }) })
  if (effects === undefined && !kept.includes("graph")) return sections
  const section: PanelSection = {
    trait: "effects",
    label: effects?.label ?? effectsCopy.section,
    open: effects?.open ?? false,
    strips: rows(controls, read, view),
  }
  if (effects === undefined) return [...sections, section]
  return sections.map((each) => (each.trait === "effects" ? section : each))
}

export function visibleEffects(section: PanelSection): PanelSection {
  if (section.trait !== "effects") return section
  return {
    ...section,
    strips: section.strips.filter((strip) => {
      const effect = strip.find((control) => isKind(control.field))
      return effect === undefined || !isKind(effect.field) || liveValue(effect.field, effect.value)
    }),
  }
}
