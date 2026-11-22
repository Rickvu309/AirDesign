import { resolveColor } from "./color.js"
import type { Effect, Paint, Px } from "./paint.js"
import type { Props } from "./props.js"
import type { ResolvedEffect, ResolvedPaint } from "./resolved.js"
import type { Theme } from "./theme.js"

const shadowOpacity = 0.25

export function resolvePaints(paints: readonly Paint[] | undefined, theme: Theme): readonly ResolvedPaint[] {
  return (paints ?? []).flatMap((paint): ResolvedPaint[] => {
    if (paint.visible === false) return []
    const opacity = paint.opacity ?? 1
    if (paint.kind === "solid") return [{ kind: "solid", color: resolveColor(paint.color, theme), opacity }]
    if (paint.kind === "gradient")
      return [
        {
          kind: "gradient",
          shape: paint.shape,
          angle: paint.angle,
          stops: paint.stops.map((stop) => ({ at: stop.at, color: resolveColor(stop.color, theme) })),
          opacity,
        },
      ]
    const { visible: _visible, opacity: _opacity, ...image } = paint
    return [{ ...image, opacity }]
  })
}

const resolveEffect = (effect: Effect, theme: Theme): ResolvedEffect =>
  "radius" in effect
    ? effect
    : {
        kind: effect.kind,
        color: resolveColor(effect.color, theme),
        opacity: effect.opacity ?? shadowOpacity,
        x: effect.x,
        y: effect.y,
        blur: effect.blur,
        spread: effect.spread,
      }

export function resolveEffects(effects: Props["effects"] | undefined, theme: Theme): readonly ResolvedEffect[] {
  if (effects === undefined) return []
  const list = typeof effects === "string" ? theme.effectStyles[effects] : effects
  return list.map((effect) => resolveEffect(effect, theme))
}

export function resolveRadius(radius: Props["radius"] | undefined): readonly [Px, Px, Px, Px] {
  if (radius === undefined) return [0, 0, 0, 0]
  return typeof radius === "number" ? [radius, radius, radius, radius] : radius
}
