import { expect, it } from "vitest"
import { type Hex, isRefusal, measureWith, resolveColor, themeLibrary } from "../index.js"
import { clusteredChartComponent, expandComponent } from "./index.js"
import { contrast, validatorDeltaE } from "./testing/palette-checks.js"

const dataOf = (series: number, categories: number) => ({
  categories: Array.from({ length: categories }, (_, i) => ({ id: `c${i}`, label: `Market ${i + 1}` })),
  series: Array.from({ length: series }, (_, i) => ({
    id: `s${i}`,
    label: `Series ${i + 1}`,
    values: Array.from({ length: categories }, (_, j) => 10 + i + j),
    fill: null,
    fills: [],
  })),
})

function expand(theme: (typeof themeLibrary)[string]["theme"], labels: boolean) {
  const result = expandComponent(clusteredChartComponent, {
    frame: { x: 0, y: 0, w: 1600, h: 780 },
    measure: measureWith({}),
    theme,
    data: dataOf(3, 3),
    variant: { orientation: "column", labels },
  })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

const cases = Object.values(themeLibrary).flatMap(({ id, theme }) =>
  [true, false].map((labels) => [id, labels, theme] as const),
)

it.each(cases)(
  "tells every series it shows apart at 3:1 on the background in %s, labels %s, and says when it shows fewer",
  (id, labels, theme) => {
    const chart = expand(theme, labels)
    const colours = chart.children.flatMap(({ key, props }) => {
      if (key[0] !== "legend-swatch" && key[0] !== "bar") return []
      const paint = props.fills?.[0]
      if (paint?.kind !== "solid") throw new Error("Expected a solid fill")
      return [resolveColor(paint.color, theme)]
    })
    const distinct = [...new Set(colours)]
    for (const [i, left] of distinct.entries()) {
      expect(contrast(left, theme.colors.background as Hex)).toBeGreaterThanOrEqual(3)
      for (const right of distinct.slice(i + 1)) expect(validatorDeltaE(left, right)).toBeGreaterThanOrEqual(15)
    }
    const swatches = chart.children.filter(({ key }) => key[0] === "legend-swatch")
    expect(swatches).toHaveLength(distinct.length)
    const capped = swatches.length < 3
    expect(capped).toBe(["editorial", "midnight", "technical"].includes(id))
    expect(chart.findings.filter(({ key }) => key[0] === "many-series")).toEqual(
      capped
        ? [
            expect.objectContaining({
              kind: "check",
              message: "This theme tells two series apart. Split the comparison across charts to show the rest.",
            }),
          ]
        : [],
    )
  },
)
