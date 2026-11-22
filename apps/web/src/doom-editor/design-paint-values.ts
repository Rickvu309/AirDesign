import type { doom } from "@airdesign/document"
import { shadowBlack } from "./shadow-art"
import { doomPaintOf, type OldPaint, oldPaintOf } from "./design-values"

export const shadowNames = ["none", "subtle", "medium", "strong"] as const
export type ShadowName = (typeof shadowNames)[number]

const black: doom.Hex = shadowBlack

const shadowShape = {
  subtle: { y: 2, blur: 6, opacity: 0.16 },
  medium: { y: 6, blur: 16, opacity: 0.24 },
  strong: { y: 12, blur: 32, opacity: 0.32 },
} as const

export function shadowOf(name: Exclude<ShadowName, "none">, opacity?: number): readonly doom.Effect[] {
  const { y, blur, opacity: usual } = shadowShape[name]
  return [{ kind: "dropShadow", color: black, opacity: opacity ?? usual, x: 0, y, blur, spread: 0 }]
}

export function shownShadow(effects: doom.Props["effects"] | undefined): {
  readonly name: ShadowName | undefined
  readonly opacity: number | null
} {
  if (effects === undefined || (Array.isArray(effects) && effects.length === 0)) return { name: "none", opacity: null }
  if (typeof effects === "string") return { name: undefined, opacity: null }
  const [only] = effects as readonly doom.Effect[]
  if (effects.length !== 1 || only === undefined || only.kind !== "dropShadow")
    return { name: undefined, opacity: null }
  const matched = (Object.keys(shadowShape) as (keyof typeof shadowShape)[]).find((name) => {
    const shape = shadowShape[name]
    return only.x === 0 && only.y === shape.y && only.blur === shape.blur && only.spread === 0 && only.color === black
  })
  return matched === undefined ? { name: undefined, opacity: null } : { name: matched, opacity: only.opacity ?? 1 }
}

export function shadowWrite(name: ShadowName, held: doom.Props["effects"] | undefined): doom.Props["effects"] | null {
  if (name === "none") return null
  const kept = shownShadow(held).opacity
  return shadowOf(name, kept === null ? undefined : kept)
}

export function shadowOpacityWrite(
  held: doom.Props["effects"] | undefined,
  opacity: number,
): doom.Props["effects"] | null {
  const { name } = shownShadow(held)
  if (name === undefined || name === "none") return held ?? null
  return shadowOf(name, Math.min(1, Math.max(0, opacity)))
}

export function shownFill(fills: readonly doom.Paint[] | undefined): OldPaint {
  const last = (fills ?? []).findLast((paint) => paint.visible !== false)
  return last === undefined ? { none: true } : oldPaintOf(last)
}

export function fillWrite(
  fills: readonly doom.Paint[] | undefined,
  value: unknown,
): readonly doom.Paint[] | null | undefined {
  const held = fills ?? []
  const at = held.findLastIndex((paint) => paint.visible !== false)
  const kept = at < 0 ? undefined : held[at]
  if (typeof value === "object" && value !== null && "none" in value) {
    if (at < 0) return undefined
    const rest = held.filter((_, index) => index !== at)
    return rest.length === 0 ? null : rest
  }
  const next = doomPaintOf(value, kept)
  if (next === null) return undefined
  return at < 0 ? [...held, next] : held.map((paint, index) => (index === at ? next : paint))
}

export type ShownStroke = {
  readonly border: "none" | "solid" | "dash" | "dot"
  readonly color: doom.Color | undefined
  readonly weight: number
}

const plainWeight = 4

export function shownStroke(
  strokes: readonly doom.Paint[] | undefined,
  stroke: doom.StrokeStyle | undefined,
): ShownStroke {
  const top = (strokes ?? []).findLast((paint) => paint.visible !== false)
  if (top === undefined) return { border: "none", color: undefined, weight: stroke?.weight ?? plainWeight }
  return {
    border: stroke?.dash ?? "solid",
    color: top.kind === "solid" ? top.color : undefined,
    weight: stroke?.weight ?? plainWeight,
  }
}

export const defaultStroke: doom.Paint = { kind: "solid", color: { var: "text" } }

export function strokePaintWrite(strokes: readonly doom.Paint[] | undefined, color: doom.Color): readonly doom.Paint[] {
  const held = strokes ?? []
  const at = held.findLastIndex((paint) => paint.visible !== false)
  const next: doom.Paint = { kind: "solid", color }
  return at < 0 ? [...held, next] : held.map((paint, index) => (index === at ? next : paint))
}
