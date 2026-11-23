import * as doom from "@airdesign/doom"
import { coreRoutes } from "@/core/core-routes"
import { barCharts } from "@/core/doom/bar-charts"
import { cardGrid } from "@/core/doom/card-grid"
import { iconSet } from "@/core/doom/icon-set"
import { kpiRow } from "@/core/doom/kpi-row"
import { lineChart } from "@/core/doom/line-chart"
import { linesArrows } from "@/core/doom/lines-arrows"
import { pictureCrop } from "@/core/doom/picture-crop"
import { titleSlide } from "@/core/doom/title-slide"

const grow = (slide: doom.TreeSlide) => doom.doomFromTree({ theme: doom.defaultTheme, slides: [slide] })

export const coreDoom = {
  [coreRoutes.titleSlide]: grow(titleSlide()),
  [coreRoutes.kpiRow]: grow(kpiRow()),
  [coreRoutes.cardGrid]: grow(cardGrid()),
  [coreRoutes.barCharts]: grow(barCharts()),
  [coreRoutes.lineChart]: grow(lineChart()),
  [coreRoutes.iconSet]: grow(iconSet()),
  [coreRoutes.linesArrows]: grow(linesArrows()),
  [coreRoutes.pictureCrop]: grow(pictureCrop()),
}

export const sampleDeck = doom.doomFromTree({
  theme: doom.defaultTheme,
  name: "Annual strategy review",
  slides: [titleSlide(), kpiRow(), barCharts(), lineChart(), cardGrid(), iconSet(), linesArrows()],
})
