import * as doom from "@airdesign/doom"
import { sampleRoutes } from "@/samples/sample-routes"
import { barChartComponents, barCharts } from "@/samples/slides/bar-charts"
import { cardGrid } from "@/samples/slides/card-grid"
import { iconSet } from "@/samples/slides/icon-set"
import { kpiRow } from "@/samples/slides/kpi-row"
import { lineChart, lineChartComponent } from "@/samples/slides/line-chart"
import { linesArrows } from "@/samples/slides/lines-arrows"
import { pictureCrop } from "@/samples/slides/picture-crop"
import { titleSlide } from "@/samples/slides/title-slide"

function grow(slides: readonly doom.TreeSlide[], name?: string) {
  const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides, ...(name === undefined ? {} : { name }) })
  const changes = grown.slides.flatMap((slide, index): doom.AgentChange[] => {
    const chart = slides[index]?.name
    const components = chart === "Bar charts" ? barChartComponents : chart === "Line chart" ? [lineChartComponent] : []
    const layers = doom.descendantsOf(grown.doom, slide)
    return components.map(({ parent, ...looks }) => {
      const into = layers.find((node) => doom.propOf(node, "name") === parent)
      if (into === undefined) throw new Error(`Missing sample exhibit: ${parent}`)
      return { op: "add", kind: "component", slide, into: into.id, ...looks }
    })
  })
  if (changes.length === 0) return grown
  let next = 0
  const built = doom.compileAgentEdit(grown.doom, changes, {
    author: { kind: "person", id: "sample" },
    once: "sample-charts",
    mint: () => doom.nodeId(`sample:${++next}`),
    measure: doom.measureWith({}),
  })
  if ("refused" in built) throw new Error(JSON.stringify(built))
  const edit = {
    ...grown.edit,
    readBase: doom.emptyDoom.rev,
    writes: [...grown.edit.writes, ...built.edit.writes],
  }
  const landed = doom.applyEdit(doom.emptyDoom, { ...edit, rev: doom.rev(1) })
  if (doom.isRefusal(landed)) throw new Error(JSON.stringify(landed))
  return { ...grown, doom: landed, edit }
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
