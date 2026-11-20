export type CanvasChartLook = {
  readonly size: number
  readonly bold: boolean
  readonly color: string | null
  readonly font: string | null
}

export type CanvasChartLine = { readonly color: string; readonly width: number }

export type CanvasChartMark = { readonly fill: string | null; readonly line: CanvasChartLine | null }

export type CanvasChartText = { readonly text: string; readonly look: CanvasChartLook }

export type CanvasChartLabel = CanvasChartText & {
  readonly position: "center" | "insideEnd" | "insideBase" | "outsideEnd" | "above" | "below" | "left" | "right"
  readonly dx: number
  readonly dy: number
}

export type CanvasChartSeries = {
  readonly name: string
  readonly values: readonly (number | null)[]
  readonly texts: readonly string[]
  readonly points: readonly CanvasChartMark[]
  readonly stroke: CanvasChartLine | null
  readonly marker: boolean
  readonly labels: readonly (CanvasChartLabel | null)[]
}

export type CanvasChartFrame = {
  readonly look: CanvasChartLook
  readonly title: CanvasChartText | null
  readonly line: CanvasChartLine | null
  readonly gridlines: CanvasChartLine | null
  readonly labels: boolean
  readonly shown: boolean
}

export type CanvasChartCategoryAxis = CanvasChartFrame & { readonly reversed: boolean }

export type CanvasChartAxis = CanvasChartFrame & {
  readonly min: number
  readonly max: number
  readonly ticks: readonly { readonly value: number; readonly text: string }[]
}

export type CanvasChart = {
  readonly kind: "pie" | "doughnut" | "bar" | "column" | "line"
  readonly grouping: "clustered" | "stacked" | "percentStacked"
  readonly hole: number
  readonly firstAngle: number
  readonly gap: number
  readonly overlap: number
  readonly categories: readonly string[]
  readonly series: readonly CanvasChartSeries[]
  readonly title: CanvasChartText | null
  readonly legend: {
    readonly position: "right" | "left" | "top" | "bottom"
    readonly look: CanvasChartLook
    readonly entries: readonly { readonly text: string; readonly mark: CanvasChartMark }[]
  } | null
  readonly fill: string | null
  readonly line: CanvasChartLine | null
  readonly plot: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null
  readonly valueAxis: CanvasChartAxis | null
  readonly categoryAxis: CanvasChartCategoryAxis | null
}
