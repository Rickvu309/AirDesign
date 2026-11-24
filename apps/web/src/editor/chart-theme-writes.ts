import * as doom from "@airdesign/doom"

export function chartWrites(id: doom.NodeId, chart: doom.Chart): readonly doom.Write[] {
  return [{ node: id, prop: "chart", value: chart }]
}

export function chartCell(chart: doom.Chart, series: number, category: number, value: number): doom.Chart {
  return {
    ...chart,
    series: chart.series.map((each, at) =>
      at === series ? { ...each, values: each.values.map((old, index) => (index === category ? value : old)) } : each,
    ),
  }
}

export function chartRow(chart: doom.Chart, category: number, name: string): doom.Chart {
  return { ...chart, categories: chart.categories.map((old, at) => (at === category ? name : old)) }
}

export function chartSeriesName(chart: doom.Chart, series: number, name: string): doom.Chart {
  const words = name.trim().slice(0, 200)
  const was = chart.series[series]
  if (words === "" || was === undefined || was.name === words) return chart
  return { ...chart, series: chart.series.map((each, at) => (at === series ? { ...each, name: words } : each)) }
}

export function chartAddRow(chart: doom.Chart): doom.Chart {
  return {
    ...chart,
    categories: [...chart.categories, `Item ${String(chart.categories.length + 1)}`],
    series: chart.series.map((each) => ({ ...each, values: [...each.values, 0] })),
  }
}

export function chartDropRow(chart: doom.Chart, category: number): doom.Chart {
  return chart.categories.length <= 1 ? chart : doom.chartWithoutCategory(chart, category)
}

export function chartAddSeries(chart: doom.Chart): doom.Chart {
  return {
    ...chart,
    series: [
      ...chart.series,
      { name: `Series ${String(chart.series.length + 1)}`, values: chart.categories.map(() => 0) },
    ],
  }
}

const hexColor = /^#[0-9a-fA-F]{6}$/

export function themeColorWrites(view: doom.Doom, name: doom.ColorVar, hex: string): readonly doom.Write[] {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined || !hexColor.test(hex)) return []
  const theme = doom.deckOf(view).theme
  const next = hex.toLowerCase() as doom.Hex
  if (theme.colors[name].toLowerCase() === next) return []
  return [{ node: deck.id, prop: "theme", value: { ...theme, colors: { ...theme.colors, [name]: next } } }]
}
