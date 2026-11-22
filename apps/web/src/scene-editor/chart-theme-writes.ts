import { scene } from "@airdesign/document"

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

export function chartSeriesName(chart: scene.Chart, series: number, name: string): scene.Chart {
  const words = name.trim().slice(0, 200)
  const was = chart.series[series]
  if (words === "" || was === undefined || was.name === words) return chart
  return { ...chart, series: chart.series.map((each, at) => (at === series ? { ...each, name: words } : each)) }
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
