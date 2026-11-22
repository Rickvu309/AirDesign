import { scene } from "@airdesign/document"
import { isGroup, scaledChildren } from "./group-scale"
import { propOf } from "./node-props"
import type { SlideGeometry } from "./slide-geometry"

type Ids = readonly scene.NodeId[]

export const plainStroke: scene.StrokeStyle = { weight: 4, align: "center", dash: "solid" }

export function setEach<K extends scene.PropName>(
  ids: Ids,
  prop: K,
  value: scene.Props[K] | null,
): readonly scene.Write[] {
  return ids.map((node) => ({ node, prop, value }))
}

export function opacityWrites(ids: Ids, percent: number): readonly scene.Write[] {
  const value = Math.min(1, Math.max(0, percent / 100))
  return setEach(ids, "opacity", value === 1 ? null : value)
}

export type BoxField = "x" | "y" | "w" | "h" | "rotation"

export function boxFieldWrites(
  view: scene.Scene,
  geometry: SlideGeometry,
  id: scene.NodeId,
  field: BoxField,
  value: number,
): readonly scene.Write[] {
  const node = view.nodes.get(id)
  const placed = geometry.byId.get(id)
  if (node === undefined || placed === undefined) return []
  const stored = propOf(node, "box") ?? placed.node.box
  const next =
    field === "w" || field === "h" ? Math.max(1, Math.round(value)) : field === "rotation" ? value : Math.round(value)
  const box = { ...stored, [field]: next }
  const writes: scene.Write[] = [{ node: id, prop: "box", value: box }]
  if (field !== "w" && field !== "h") return writes
  const was = field === "w" ? placed.node.box.w : placed.node.box.h
  if (next === Math.round(was)) return writes
  if (isGroup(view, id)) {
    const across = field === "w" ? next / placed.node.box.w : 1
    const down = field === "h" ? next / placed.node.box.h : 1
    return [...writes, ...scaledChildren(view, geometry, id, across, down)]
  }
  const sizing = propOf(node, "sizing") ?? { w: "fixed" as const, h: "fixed" as const }
  if (sizing[field] !== "fixed") writes.push({ node: id, prop: "sizing", value: { ...sizing, [field]: "fixed" } })
  const text = node.type === "shape" ? propOf(node, "text") : undefined
  if (text !== undefined && (text.resize === "widthAndHeight" || (text.resize === "height" && field === "h")))
    writes.push({
      node: id,
      prop: "text",
      value: { ...text, resize: field === "w" && text.resize === "widthAndHeight" ? "height" : "fixed" },
    })
  return writes
}

export type SizingChange = { readonly axis: "w" | "h"; readonly mode: scene.Sizing["w"] }

export function sizingWrites(view: scene.Scene, ids: Ids, change: SizingChange): readonly scene.Write[] {
  return ids.flatMap((node): scene.Write[] => {
    const sizing = propOf(view.nodes.get(node), "sizing") ?? { w: "fixed" as const, h: "fixed" as const }
    return sizing[change.axis] === change.mode
      ? []
      : [{ node, prop: "sizing" as const, value: { ...sizing, [change.axis]: change.mode } }]
  })
}

export function strokeWrites(view: scene.Scene, ids: Ids, patch: Partial<scene.StrokeStyle>): readonly scene.Write[] {
  return ids.map((node) => ({
    node,
    prop: "stroke" as const,
    value: { ...(propOf(view.nodes.get(node), "stroke") ?? plainStroke), ...patch },
  }))
}

export type LayoutMode = scene.Layout["mode"]

const sides = (all: number) => ({ t: all, r: all, b: all, l: all })

export function layoutModeWrites(view: scene.Scene, ids: Ids, mode: LayoutMode): readonly scene.Write[] {
  return ids.map((node) => {
    const was = propOf(view.nodes.get(node), "layout") ?? { mode: "none" as const }
    if (mode === "none") return { node, prop: "layout" as const, value: { mode: "none" } }
    const gap = "gap" in was ? was.gap : 16
    const padding = "padding" in was ? was.padding : sides(0)
    if (mode === "grid")
      return {
        node,
        prop: "layout" as const,
        value: { mode, columns: [{ fr: 1 }, { fr: 1 }], rows: ["hug"], gap, padding },
      }
    return {
      node,
      prop: "layout" as const,
      value: { mode, gap, padding, align: "align" in was ? was.align : "top-left" },
    }
  })
}

export type LayoutPatch = {
  readonly gap?: number
  readonly padding?: number
  readonly align?: scene.Align9
  readonly columns?: number
}

export function layoutPatchWrites(view: scene.Scene, ids: Ids, patch: LayoutPatch): readonly scene.Write[] {
  return ids.flatMap((node): scene.Write[] => {
    const was = propOf(view.nodes.get(node), "layout")
    if (was === undefined || was.mode === "none") return []
    const gap = patch.gap === undefined ? was.gap : Math.max(0, Math.round(patch.gap))
    const padding = patch.padding === undefined ? was.padding : sides(Math.max(0, Math.round(patch.padding)))
    if (was.mode === "grid") {
      const count =
        patch.columns === undefined ? was.columns.length : Math.max(1, Math.min(12, Math.round(patch.columns)))
      const columns = Array.from({ length: count }, (_, at) => was.columns[at] ?? { fr: 1 })
      return [{ node, prop: "layout" as const, value: { ...was, gap, padding, columns } }]
    }
    return [{ node, prop: "layout" as const, value: { ...was, gap, padding, align: patch.align ?? was.align } }]
  })
}

export type TextChange = {
  readonly style?: scene.TextStyleName
  readonly align?: NonNullable<scene.Para["align"]>
  readonly alignV?: scene.Text["alignV"]
  readonly resize?: scene.Text["resize"]
}

export function textFieldWrites(view: scene.Scene, ids: Ids, change: TextChange): readonly scene.Write[] {
  return ids.flatMap((node): scene.Write[] => {
    const text = propOf(view.nodes.get(node), "text")
    if (text === undefined) return []
    const next: scene.Text = {
      ...text,
      ...(change.style === undefined ? {} : { style: change.style }),
      ...(change.alignV === undefined ? {} : { alignV: change.alignV }),
      ...(change.resize === undefined ? {} : { resize: change.resize }),
      ...(change.align === undefined ? {} : { paras: text.paras.map((para) => ({ ...para, align: change.align })) }),
    }
    return [{ node, prop: "text" as const, value: next }]
  })
}

export function chartWrites(id: scene.NodeId, chart: scene.Chart): readonly scene.Write[] {
  return [{ node: id, prop: "chart", value: chart }]
}

export function chartCell(chart: scene.Chart, series: number, category: number, value: number): scene.Chart {
  return {
    ...chart,
    series: chart.series.map((each, at) =>
      at === series ? { ...each, values: each.values.map((old, index) => (index === category ? value : old)) } : each,
    ),
  }
}

export function chartRow(chart: scene.Chart, category: number, name: string): scene.Chart {
  return { ...chart, categories: chart.categories.map((old, at) => (at === category ? name : old)) }
}

export function chartAddRow(chart: scene.Chart): scene.Chart {
  return {
    ...chart,
    categories: [...chart.categories, `Item ${String(chart.categories.length + 1)}`],
    series: chart.series.map((each) => ({ ...each, values: [...each.values, 0] })),
  }
}

export function chartDropRow(chart: scene.Chart, category: number): scene.Chart {
  if (chart.categories.length <= 1) return chart
  return {
    ...chart,
    categories: chart.categories.filter((_, at) => at !== category),
    series: chart.series.map((each) => ({ ...each, values: each.values.filter((_, at) => at !== category) })),
  }
}

export function chartAddSeries(chart: scene.Chart): scene.Chart {
  return {
    ...chart,
    series: [
      ...chart.series,
      { name: `Series ${String(chart.series.length + 1)}`, values: chart.categories.map(() => 0) },
    ],
  }
}

const hexColor = /^#[0-9a-fA-F]{6}$/

export function themeColorWrites(view: scene.Scene, name: scene.ColorVar, hex: string): readonly scene.Write[] {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined || !hexColor.test(hex)) return []
  const theme = scene.deckOf(view).theme
  const next = hex.toLowerCase() as scene.Hex
  if (theme.colors[name].toLowerCase() === next) return []
  return [{ node: deck.id, prop: "theme", value: { ...theme, colors: { ...theme.colors, [name]: next } } }]
}
