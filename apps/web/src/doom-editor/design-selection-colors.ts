import * as doom from "@airdesign/doom"
import { propOf } from "@/editing/node-props"

export type ColorRow = { readonly hex: string; readonly color: doom.Color }

type Scope = { readonly slide: doom.NodeId; readonly ids: readonly doom.NodeId[] }

export function nodesInScope(view: doom.Doom, scope: Scope): readonly doom.NodeId[] {
  const roots = scope.ids.length === 0 ? [scope.slide] : scope.ids
  const found: doom.NodeId[] = []
  const seen = new Set<doom.NodeId>()
  const visit = (id: doom.NodeId) => {
    if (seen.has(id)) return
    seen.add(id)
    found.push(id)
    for (const child of view.children.get(id) ?? []) visit(child)
  }
  for (const root of roots) visit(root)
  return found
}

function hexOf(color: doom.Color, theme: doom.Theme): string {
  return doom.resolveColor(color, theme).slice(1).toUpperCase()
}

function paintColors(paints: readonly doom.Paint[] | undefined): readonly doom.Color[] {
  return (paints ?? []).flatMap((paint) =>
    paint.kind === "solid" ? [paint.color] : paint.kind === "gradient" ? paint.stops.map((stop) => stop.color) : [],
  )
}

function textColors(text: doom.Text | undefined): readonly doom.Color[] {
  if (text === undefined || text.chars === "") return []
  if (text.spans.length === 0) return [{ var: "text" }]
  return text.spans.map((span) => span.color ?? { var: "text" })
}

function colorsOf(view: doom.Doom, id: doom.NodeId): readonly doom.Color[] {
  const node = view.nodes.get(id)
  if (node === undefined) return []
  return [
    ...paintColors(propOf(node, "fills")),
    ...paintColors(propOf(node, "strokes")),
    ...textColors(propOf(node, "text")),
  ]
}

const brightness = (hex: string) =>
  0.2126 * Number.parseInt(hex.slice(0, 2), 16) +
  0.7152 * Number.parseInt(hex.slice(2, 4), 16) +
  0.0722 * Number.parseInt(hex.slice(4, 6), 16)

export function colorRows(view: doom.Doom, theme: doom.Theme, scope: Scope): readonly ColorRow[] {
  const rows = new Map<string, doom.Color>()
  for (const id of nodesInScope(view, scope))
    for (const color of colorsOf(view, id)) {
      const hex = hexOf(color, theme)
      if (!rows.has(hex)) rows.set(hex, color)
    }
  return [...rows]
    .map(([hex, color]) => ({ hex, color }))
    .sort((a, b) => brightness(a.hex) - brightness(b.hex) || a.hex.localeCompare(b.hex))
}

export function idsWithColor(view: doom.Doom, theme: doom.Theme, scope: Scope, hex: string): readonly doom.NodeId[] {
  return nodesInScope(view, scope).filter(
    (id) => id !== scope.slide && colorsOf(view, id).some((color) => hexOf(color, theme) === hex),
  )
}

function swapPaints(
  paints: readonly doom.Paint[] | undefined,
  theme: doom.Theme,
  hex: string,
  to: doom.Color,
): readonly doom.Paint[] | null {
  if (paints === undefined) return null
  const same = (color: doom.Color) => hexOf(color, theme) === hex
  let changed = false
  const next = paints.map((paint): doom.Paint => {
    if (paint.kind === "solid" && same(paint.color)) {
      changed = true
      return { ...paint, color: to }
    }
    if (paint.kind === "gradient" && paint.stops.some((stop) => same(stop.color))) {
      changed = true
      return { ...paint, stops: paint.stops.map((stop) => (same(stop.color) ? { ...stop, color: to } : stop)) }
    }
    return paint
  })
  return changed ? next : null
}

function swapText(text: doom.Text | undefined, theme: doom.Theme, hex: string, to: doom.Color): doom.Text | null {
  if (text === undefined || text.chars === "") return null
  const same = (color: doom.Color | undefined) => hexOf(color ?? { var: "text" }, theme) === hex
  const spans = text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
  if (!spans.some((span) => same(span.color))) return null
  return { ...text, spans: spans.map((span) => (same(span.color) ? { ...span, color: to } : span)) }
}

export function replaceColorWrites(
  view: doom.Doom,
  theme: doom.Theme,
  scope: Scope,
  hex: string,
  to: doom.Color,
): readonly doom.Write[] {
  return nodesInScope(view, scope).flatMap((node): doom.Write[] => {
    const held = view.nodes.get(node)
    if (held === undefined) return []
    const fills = swapPaints(propOf(held, "fills"), theme, hex, to)
    const strokes = swapPaints(propOf(held, "strokes"), theme, hex, to)
    const text = swapText(propOf(held, "text"), theme, hex, to)
    return [
      ...(fills === null ? [] : [{ node, prop: "fills" as const, value: fills }]),
      ...(strokes === null ? [] : [{ node, prop: "strokes" as const, value: strokes }]),
      ...(text === null ? [] : [{ node, prop: "text" as const, value: text }]),
    ]
  })
}
