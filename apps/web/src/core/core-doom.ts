import { coreRoutes } from "@/core/core-routes"
import { barCharts } from "@/core/doom/bar-charts"
import { cardGrid } from "@/core/doom/card-grid"
import { iconSet } from "@/core/doom/icon-set"
import { kpiRow } from "@/core/doom/kpi-row"
import { lineChart } from "@/core/doom/line-chart"
import { linesArrows } from "@/core/doom/lines-arrows"
import { pictureCrop } from "@/core/doom/picture-crop"
import { titleSlide } from "@/core/doom/title-slide"

export const coreDoom = {
  [coreRoutes.titleSlide]: titleSlide(),
  [coreRoutes.kpiRow]: kpiRow(),
  [coreRoutes.cardGrid]: cardGrid(),
  [coreRoutes.barCharts]: barCharts(),
  [coreRoutes.lineChart]: lineChart(),
  [coreRoutes.iconSet]: iconSet(),
  [coreRoutes.linesArrows]: linesArrows(),
  [coreRoutes.pictureCrop]: pictureCrop(),
}
