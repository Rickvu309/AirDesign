import type * as doom from "@airdesign/doom"
import type { PanelPaint } from "@/design/panel"
import { doomPaintOf, panelPaintOf } from "./design-values"

export function shownFill(fills: readonly doom.Paint[] | undefined): PanelPaint {
  const last = (fills ?? []).findLast((paint) => paint.visible !== false)
  return last === undefined ? { none: true } : panelPaintOf(last)
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
}

export function shownStroke(
  strokes: readonly doom.Paint[] | undefined,
  stroke: doom.StrokeStyle | undefined,
): ShownStroke {
  const top = (strokes ?? []).findLast((paint) => paint.visible !== false)
  if (top === undefined) return { border: "none", color: undefined }
  return {
    border: stroke?.dash ?? "solid",
    color: top.kind === "solid" ? top.color : undefined,
  }
}

export const defaultStroke: doom.Paint = { kind: "solid", color: { var: "text" } }

export function strokePaintWrite(strokes: readonly doom.Paint[] | undefined, color: doom.Color): readonly doom.Paint[] {
  const held = strokes ?? []
  const at = held.findLastIndex((paint) => paint.visible !== false)
  const next: doom.Paint = { kind: "solid", color }
  return at < 0 ? [...held, next] : held.map((paint, index) => (index === at ? next : paint))
}
