import { describe, expect, it } from "vitest"
import { type Box, type Chart, type Resolved, deriveChart, nodeId } from "./index.js"
import { defaultTheme } from "./default-theme-art.js"
import { spot } from "./testing/doom-fixtures-art.js"
import { interMeasure as measure } from "./testing/inter-measure.js"

const frame = nodeId("t:9")
const units = [undefined, "thousand USD", "دولار", "$M"] as const
const kinds = ["line", "bar", "column", "stacked", "pie"] as const

const huge = [-2.5, 0, 987654321012.34, 0.004, 324000000000.25]
const names = ["Loss", "Zero", "Huge", "Tiny", "Major"]
const numbered = (count: number) => Array.from({ length: count }, (_, at) => `Category ${String(at + 1)}`)
const spread = (count: number) =>
  Array.from({ length: count }, (_, at) => [1200, -300, 45.5, 880, 2500, 15][at % 6]! * (1 + (at % 3)))

const fixtures = [
  { name: "900x460 extreme values", w: 900, h: 460, categories: names, values: [huge] },
  {
    name: "900x460 two series",
    w: 900,
    h: 460,
    categories: names,
    values: [huge, huge.map((value) => value * 0.9 - 1)],
  },
  { name: "900x460 eight categories", w: 900, h: 460, categories: numbered(8), values: [spread(8)] },
  { name: "640x400", w: 640, h: 400, categories: names, values: [[120, -30, 450.5, 88, 250]] },
  { name: "900x460 twenty categories", w: 900, h: 460, categories: numbered(20), values: [spread(20)] },
  { name: "360x300", w: 360, h: 300, categories: names, values: [huge] },
  { name: "240x200", w: 240, h: 200, categories: names, values: [huge] },
]

const lineBoxes = (part: Resolved): { readonly text: string; readonly box: Box }[] =>
  part.text === null
    ? []
    : part.text.lines.map((line) => {
        return {
          text: line.runs.map((run) => run.text).join(""),
          box: { ...part.box, x: part.box.x + line.x, y: part.box.y + line.y, w: line.w, h: line.h },
        }
      })

const crossing = (a: Box, b: Box) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01

describe("a chart's text never overlaps other chart text", () => {
  for (const fixture of fixtures)
    for (const kind of kinds)
      for (const unit of units) {
        it(`${kind} ${fixture.name} unit ${JSON.stringify(unit)}`, () => {
          const chart: Chart = {
            kind,
            labels: true,
            categories: fixture.categories,
            series: (kind === "pie" ? fixture.values.slice(0, 1) : fixture.values).map((values, at) => ({
              name: at === 0 ? "Sales" : "Cost",
              values,
            })),
            ...(unit === undefined ? {} : { unit }),
          }
          const texts = deriveChart(frame, chart, spot(0, 0, fixture.w, fixture.h), defaultTheme, measure).flatMap(
            lineBoxes,
          )
          expect(texts.length).toBeGreaterThan(0)
          const clashes = texts.flatMap((a, at) =>
            texts
              .slice(at + 1)
              .filter((b) => crossing(a.box, b.box))
              .map((b) => `${a.text} | ${b.text}`),
          )
          expect(clashes).toEqual([])
          if (kind === "bar" || kind === "column") {
            const parts = deriveChart(frame, chart, spot(0, 0, fixture.w, fixture.h), defaultTheme, measure)
            const bars = parts.filter((part) => !part.id.includes("~") && part.geometry?.kind === "rect")
            const onOthers = parts
              .filter((part) => part.id.startsWith("t:9#~value:"))
              .flatMap((part) =>
                lineBoxes(part).flatMap((ink) =>
                  bars
                    .filter((bar) => bar.id !== part.id.replace("#~value:", "#"))
                    .filter((bar) => crossing(ink.box, bar.box))
                    .map((bar) => `${part.id} over ${bar.id}`),
                ),
              )
            expect(onOthers).toEqual([])
          }
          for (const { text, box } of texts) {
            expect(box.x, text).toBeGreaterThanOrEqual(-0.5)
            expect(box.y, text).toBeGreaterThanOrEqual(-0.5)
            expect(box.x + box.w, text).toBeLessThanOrEqual(fixture.w + 0.5)
            expect(box.y + box.h, text).toBeLessThanOrEqual(fixture.h + 0.5)
          }
        })
      }

  it("keeps the largest value label on a chart with room", () => {
    for (const kind of ["line", "bar", "column"] as const) {
      const parts = deriveChart(
        frame,
        { kind, labels: true, categories: names, series: [{ name: "Sales", values: huge }], unit: "thousand USD" },
        spot(0, 0, 900, 330),
        defaultTheme,
        measure,
      )
      expect(
        parts.some((part) => part.id === "t:9#~value:0:2"),
        kind,
      ).toBe(true)
    }
  })
})
