import * as doom from "@airdesign/doom"
import { sampleRoutes } from "@/samples/sample-routes"
import { barCharts } from "@/samples/slides/bar-charts"
import { cardGrid } from "@/samples/slides/card-grid"
import { iconSet } from "@/samples/slides/icon-set"
import { kpiRow } from "@/samples/slides/kpi-row"
import { lineChart } from "@/samples/slides/line-chart"
import { linesArrows } from "@/samples/slides/lines-arrows"
import { pictureCrop } from "@/samples/slides/picture-crop"
import { titleSlide } from "@/samples/slides/title-slide"

function grow(slides: readonly doom.TreeSlide[], name?: string) {
  return doom.doomFromTree({ theme: doom.defaultTheme, slides, ...(name === undefined ? {} : { name }) })
}

export const sampleSlides = {
  [sampleRoutes.titleSlide]: grow([titleSlide()]),
  [sampleRoutes.kpiRow]: grow([kpiRow()]),
  [sampleRoutes.cardGrid]: grow([cardGrid()]),
  [sampleRoutes.barCharts]: grow([barCharts()]),
  [sampleRoutes.lineChart]: grow([lineChart()]),
  [sampleRoutes.iconSet]: grow([iconSet()]),
  [sampleRoutes.linesArrows]: grow([linesArrows()]),
  [sampleRoutes.pictureCrop]: grow([pictureCrop()]),
}

export const sampleDeck = grow(
  [titleSlide(), kpiRow(), barCharts(), lineChart(), cardGrid(), iconSet(), linesArrows()],
  "Annual strategy review",
)
