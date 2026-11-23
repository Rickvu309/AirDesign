import * as doom from "@airdesign/doom"
import type { CSSProperties } from "react"

type Effect = doom.ResolvedEffect
export type Shadow = Extract<Effect, { color: string }>

export const withOpacity = (hex: string, opacity: number): string => {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
  return `rgb(${String(r)} ${String(g)} ${String(b)} / ${String(opacity)})`
}

const shadowText = (effect: Shadow, inset: boolean) =>
  `${inset ? "inset " : ""}${String(effect.x)}px ${String(effect.y)}px ${String(effect.blur)}px ${String(effect.spread)}px ${withOpacity(effect.color, effect.opacity)}`

const letterShadowText = (effect: Shadow) =>
  `${String(effect.x)}px ${String(effect.y)}px ${String(effect.blur)}px ${withOpacity(effect.color, effect.opacity)}`

const dropShadowText = (effect: Shadow) =>
  `drop-shadow(${String(effect.x)}px ${String(effect.y)}px ${String(effect.blur / 2)}px ${withOpacity(effect.color, effect.opacity)})`

export type ShadowFrom = "box" | "outline" | "contents" | "typing"

export type InnerShadows = { readonly id: string; readonly shadows: readonly Shadow[] }

export type EffectLook = {
  readonly boxShadow: CSSProperties["boxShadow"]
  readonly bodyFilter: CSSProperties["filter"]
  readonly wholeFilter: CSSProperties["filter"]
  readonly textShadow: CSSProperties["textShadow"]
  readonly inner: InnerShadows | undefined
  readonly backdrop: CSSProperties["backdropFilter"]
}

const joined = (parts: readonly string[], by: string): string | undefined =>
  parts.length === 0 ? undefined : parts.join(by)

export function effectLook(effects: readonly Effect[], from: ShadowFrom, innerId: string): EffectLook {
  const shadows = effects.filter((effect): effect is Shadow => "color" in effect)
  const drops = shadows.filter((effect) => effect.kind === "dropShadow")
  const inners = shadows.filter((effect) => effect.kind === "innerShadow")
  const layer = effects.find((effect) => effect.kind === "layerBlur")
  const behind = effects.find((effect) => effect.kind === "backgroundBlur")
  const inner =
    (from === "outline" || from === "contents") && inners.length > 0 ? { id: innerId, shadows: inners } : undefined
  const filtered = [...(inner === undefined ? [] : [`url(#${inner.id})`]), ...drops.map(dropShadowText)]
  const layerBlur = layer === undefined || !("radius" in layer) ? [] : [`blur(${String(layer.radius / 2)}px)`]
  return {
    boxShadow:
      from === "box"
        ? joined([...drops.map((e) => shadowText(e, false)), ...inners.map((e) => shadowText(e, true))], ", ")
        : undefined,
    bodyFilter: from === "outline" ? joined(filtered, " ") : undefined,
    wholeFilter: joined([...(from === "contents" ? filtered : []), ...layerBlur], " "),
    textShadow: from === "typing" ? joined(drops.map(letterShadowText), ", ") : undefined,
    inner,
    backdrop: behind === undefined || !("radius" in behind) ? undefined : `blur(${String(behind.radius / 2)}px)`,
  }
}
