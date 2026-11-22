import type { doom } from "@airdesign/document"
import type { CSSProperties } from "react"

type Effect = doom.ResolvedEffect

export const withOpacity = (hex: string, opacity: number): string => {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
  return `rgb(${String(r)} ${String(g)} ${String(b)} / ${String(opacity)})`
}

const shadowText = (effect: Extract<Effect, { color: string }>, inset: boolean) =>
  `${inset ? "inset " : ""}${String(effect.x)}px ${String(effect.y)}px ${String(effect.blur)}px ${String(effect.spread)}px ${withOpacity(effect.color, effect.opacity)}`

export type EffectLook = {
  readonly boxShadow: CSSProperties["boxShadow"]
  readonly dropFilter: CSSProperties["filter"]
  readonly blur: CSSProperties["filter"]
  readonly backdrop: CSSProperties["backdropFilter"]
}

export function effectLook(effects: readonly Effect[], boxy: boolean): EffectLook {
  const shadows = effects.filter((effect) => "color" in effect)
  const drops = shadows.filter((effect) => effect.kind === "dropShadow")
  const inners = shadows.filter((effect) => effect.kind === "innerShadow")
  const layer = effects.find((effect) => effect.kind === "layerBlur")
  const behind = effects.find((effect) => effect.kind === "backgroundBlur")
  const boxShadow = boxy
    ? [...drops.map((effect) => shadowText(effect, false)), ...inners.map((effect) => shadowText(effect, true))].join(
        ", ",
      )
    : ""
  const dropFilter = boxy
    ? ""
    : drops
        .map(
          (effect) =>
            `drop-shadow(${String(effect.x)}px ${String(effect.y)}px ${String(effect.blur / 2)}px ${withOpacity(effect.color, effect.opacity)})`,
        )
        .join(" ")
  return {
    boxShadow: boxShadow === "" ? undefined : boxShadow,
    dropFilter: dropFilter === "" ? undefined : dropFilter,
    blur: layer === undefined || !("radius" in layer) ? undefined : `blur(${String(layer.radius / 2)}px)`,
    backdrop: behind === undefined || !("radius" in behind) ? undefined : `blur(${String(behind.radius / 2)}px)`,
  }
}
