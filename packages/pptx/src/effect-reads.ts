import type { DesignKey, GlowRead, Read, ShadowRead, Source } from "@airdesign/document"
import { colorIn } from "./color-read.js"
import { child, whole, type Held } from "./markup-held.js"
import { referenceOf } from "./style-reference.js"
import type { Styles } from "./trait-read.js"

const read = <Value>(value: Value, source: Source | undefined): Read<Value> =>
  source === undefined ? { value } : { value, source }

const effectKeys = ["effects.shadow", "effects.glow", "effects.softEdge"] as const

export function effectReads(
  properties: readonly Held[],
  owners: readonly Held[],
  styles: Styles,
  reads: Partial<Record<DesignKey, Read<unknown>>>,
  kept: DesignKey[],
) {
  const effects = properties.find(
    (held) => child(held, "a:effectLst") !== undefined || child(held, "a:effectDag") !== undefined,
  )
  const effectReference = effects === undefined ? referenceOf(owners, "a:effectRef", styles.effects) : undefined
  const slot =
    effects ?? (effectReference === undefined || effectReference === "none" ? undefined : effectReference.entry)
  if (slot !== undefined && child(slot, "a:effectDag") !== undefined) kept.push(...effectKeys)
  const list =
    effects !== undefined
      ? { held: child(effects, "a:effectLst"), placed: null }
      : effectReference === undefined || effectReference === "none"
        ? undefined
        : { held: child(effectReference.entry, "a:effectLst"), placed: effectReference.placed }
  if (list === undefined) return
  const shadow = child(list.held, "a:outerShdw")
  if (shadow !== undefined) {
    const value: ShadowRead = {
      blur: whole(shadow.element, "blurRad") ?? 0,
      distance: whole(shadow.element, "dist") ?? 0,
      direction: whole(shadow.element, "dir") ?? 0,
      color: colorIn(shadow, list.placed),
    }
    reads["effects.shadow"] = read(value, shadow.source)
  }
  const glow = child(list.held, "a:glow")
  if (glow !== undefined) {
    const value: GlowRead = { radius: whole(glow.element, "rad") ?? 0, color: colorIn(glow, list.placed) }
    reads["effects.glow"] = read(value, glow.source)
  }
  const soft = child(list.held, "a:softEdge")
  const softRadius = soft === undefined ? undefined : whole(soft.element, "rad")
  if (soft !== undefined && softRadius !== undefined && softRadius > 0)
    reads["effects.softEdge"] = read(softRadius, soft.source)
}
