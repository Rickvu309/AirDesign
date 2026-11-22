import { coreRoutes } from "@/core/core-routes"
import { barCharts } from "@/core/scenes/bar-charts"
import { cardGrid } from "@/core/scenes/card-grid"
import { iconSet } from "@/core/scenes/icon-set"
import { kpiRow } from "@/core/scenes/kpi-row"
import { lineChart } from "@/core/scenes/line-chart"
import { linesArrows } from "@/core/scenes/lines-arrows"
import { pictureCrop } from "@/core/scenes/picture-crop"
import { titleSlide } from "@/core/scenes/title-slide"

export const coreScenes = {
  [coreRoutes.titleSlide]: titleSlide(),
  [coreRoutes.kpiRow]: kpiRow(),
  [coreRoutes.cardGrid]: cardGrid(),
  [coreRoutes.barCharts]: barCharts(),
  [coreRoutes.lineChart]: lineChart(),
  [coreRoutes.iconSet]: iconSet(),
  [coreRoutes.linesArrows]: linesArrows(),
  [coreRoutes.pictureCrop]: pictureCrop(),
}
