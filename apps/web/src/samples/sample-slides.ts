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

const grow = (slide: doom.TreeSlide) => doom.doomFromTree({ theme: doom.defaultTheme, slides: [slide] })

export const sampleSlides = {
  [sampleRoutes.titleSlide]: grow(titleSlide()),
  [sampleRoutes.kpiRow]: grow(kpiRow()),
  [sampleRoutes.cardGrid]: grow(cardGrid()),
  [sampleRoutes.barCharts]: grow(barCharts()),
  [sampleRoutes.lineChart]: grow(lineChart()),
  [sampleRoutes.iconSet]: grow(iconSet()),
  [sampleRoutes.linesArrows]: grow(linesArrows()),
  [sampleRoutes.pictureCrop]: grow(pictureCrop()),
}

export const sampleDeck = doom.doomFromTree({
  theme: doom.defaultTheme,
  name: "Annual strategy review",
  slides: [titleSlide(), kpiRow(), barCharts(), lineChart(), cardGrid(), iconSet(), linesArrows()],
})
