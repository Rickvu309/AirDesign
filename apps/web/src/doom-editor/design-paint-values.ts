import * as doom from "@airdesign/doom"
import { doomPaintOf, type OldPaint, oldPaintOf } from "./design-values"

export const shadowNames = ["none", ...doom.effectStyleNames] as const
export type ShadowName = (typeof shadowNames)[number]

type Shown = { readonly name: ShadowName | undefined; readonly opacity: number | null }

const unknown: Shown = { name: undefined, opacity: null }

const isStyle = (name: string): name is doom.EffectStyleName =>
  (doom.effectStyleNames as readonly string[]).includes(name)

const opacityOf = (effects: readonly doom.Effect[]): number | null => {
  const shadow = effects.find((effect) => "color" in effect)
  return shadow === undefined || !("color" in shadow) ? null : (shadow.opacity ?? 1)
}

const fadedTo = (effects: readonly doom.Effect[], opacity: number): readonly doom.Effect[] =>
  effects.map((effect) => ("color" in effect ? { ...effect, opacity } : effect))

const colorKey = (color: doom.Color): string =>
  typeof color === "string" ? color.toLowerCase() : `${color.var}:${String(color.tint ?? 0)}`

function sameEffect(a: doom.Effect, b: doom.Effect): boolean {
  if (a.kind !== b.kind) return false
  if ("radius" in a || "radius" in b) return "radius" in a && "radius" in b && a.radius === b.radius
  return (
    a.x === b.x && a.y === b.y && a.blur === b.blur && a.spread === b.spread && colorKey(a.color) === colorKey(b.color)
  )
}

const sameLook = (a: readonly doom.Effect[], b: readonly doom.Effect[]): boolean =>
  a.length === b.length && a.every((effect, at) => sameEffect(effect, b[at]!))

export function shownShadow(effects: doom.Props["effects"] | undefined, theme: doom.Theme): Shown {
  if (effects === undefined || (Array.isArray(effects) && effects.length === 0)) return { name: "none", opacity: null }
  if (typeof effects === "string")
    return isStyle(effects) ? { name: effects, opacity: opacityOf(theme.effectStyles[effects]) } : unknown
  const list = effects as readonly doom.Effect[]
  const matched = doom.effectStyleNames.find((name) => sameLook(theme.effectStyles[name], list))
  return matched === undefined ? unknown : { name: matched, opacity: opacityOf(list) }
}

export const shadowWrite = (name: ShadowName): doom.Props["effects"] | null => (name === "none" ? null : name)

export function shadowOpacityWrite(
  held: doom.Props["effects"] | undefined,
  opacity: number,
  theme: doom.Theme,
): doom.Props["effects"] | null {
  const { name } = shownShadow(held, theme)
  if (name === undefined || name === "none") return held ?? null
  return fadedTo(theme.effectStyles[name], Math.min(1, Math.max(0, opacity)))
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
