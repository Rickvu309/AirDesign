import * as doom from "@airdesign/doom"
import { guide } from "@airdesign/taste"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Answer = Record<string, any>

function agent() {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ...result, fields: result.fields as Answer }
  }
  return { call, fold: (deck: string) => decks.decks.get(deck as never)! }
}

const recipe = (kind: string): string => {
  const markdown = guide(`charts/${kind}`)?.markdown ?? ""
  const block = /```js\n([\s\S]*?)```/.exec(markdown)?.[1]
  expect(block, kind).toBeDefined()
  return block!
}

const extent = (lines: readonly string[], name: string) => {
  const first = lines.findIndex((line) => line.startsWith(`const ${name} = `))
  expect(first, name).toBeGreaterThanOrEqual(0)
  const after = lines.findIndex((line, at) => at > first && /^\S/.test(line) && !/^[\])}]/.test(line))
  return { first, after }
}

const given = (script: string, name: string, value: unknown) => {
  const lines = script.split("\n")
  const { first, after } = extent(lines, name)
  const code = typeof value === "function" ? String(value) : JSON.stringify(value)
  return [...lines.slice(0, first), `const ${name} = ${code}`, ...lines.slice(after)].join("\n")
}

const sample = (kind: string, name: string): any => {
  const lines = recipe(kind).split("\n")
  const { first, after } = extent(lines, name)
  const code = lines.slice(first, after).join("\n").slice(`const ${name} = `.length)
  return new Function(`return (${code})`)()
}

const withData = (kind: string, data: Readonly<Record<string, unknown>>) =>
  Object.entries(data).reduce((script, [name, value]) => given(script, name, value), recipe(kind))

async function drawn(style: string, script: string) {
  const by = agent()
  const created = await by.call("execute", { script: `createDeck({ style: "${style}" })` })
  expect(created.ok, JSON.stringify(created.fields)).toBe(true)
  const { deck, slides } = created.fields as { deck: string; slides: string[] }
  const answer = await by.call("execute", { deck, script: given(script, "slide", slides[0]) })
  expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
  const fold = by.fold(deck)
  const chart = doom.childrenOf(fold, slides[0] as doom.NodeId).at(-1)!
  return { answer: answer.fields, fold, chart }
}

const layersNamed = (fold: doom.Doom, chart: doom.Node, name: string) =>
  doom.childrenOf(fold, chart.id).filter((node) => doom.propOf(node, "name") === name)
const boxOf = (node: doom.Node) => doom.propOf(node, "box")!

const filled = (node: doom.Node) =>
  JSON.stringify(doom.propOf(node, "fills")?.map((paint) => (paint.kind === "solid" ? paint.color : null)) ?? [])
const charsOf = (node: doom.Node) => doom.propOf(node, "text")?.chars ?? ""
const points = (node: doom.Node) => {
  const box = boxOf(node)
  const d = doom.propOf(node, "geometry") as { d: string }
  return [...d.d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(([, x, y]) => ({
    x: box.x + Number(x) * box.w,
    y: box.y + Number(y) * box.h,
  }))
}

type Rows = readonly (readonly [string, number])[]
type Series = readonly (readonly [string, readonly number[]])[]
type Drawn = Awaited<ReturnType<typeof drawn>>

function barDrawn({ answer, fold, chart }: Drawn, rows: Rows, accent: string) {
  expect(answer.problems).toEqual([])
  const ranked = rows.toSorted((a, b) => Number(a[0] === "Other") - Number(b[0] === "Other") || b[1] - a[1])
  const largest = Math.max(...rows.map(([, value]) => value))
  expect(layersNamed(fold, chart, "Name").map(charsOf)).toEqual(ranked.map(([name]) => name))
  const bars = layersNamed(fold, chart, "Bar")
  const values = layersNamed(fold, chart, "Value").map(boxOf)
  expect(values[0]!.x + values[0]!.w).toBe(boxOf(chart).w)
  const track = boxOf(bars[0]!).w
  ranked.forEach(([name, value], i) => {
    expect(Math.abs(boxOf(bars[i]!).w - (track * value) / largest), name).toBeLessThanOrEqual(1)
    expect(boxOf(bars[i]!).x).toBe(boxOf(bars[0]!).x)
  })
  expect(bars.map(filled).map((fill) => fill.includes("accent1"))).toEqual(ranked.map(([name]) => name === accent))
}

function columnDrawn({ answer, fold, chart }: Drawn, rows: Rows) {
  expect(answer.problems).toEqual([])
  const largest = Math.max(...rows.map(([, value]) => value))
  const columns = layersNamed(fold, chart, "Column").map(boxOf)
  const zero = boxOf(layersNamed(fold, chart, "Zero line")[0]!)
  const tallest = Math.max(...columns.map((column) => column.h))
  expect(layersNamed(fold, chart, "Name").map(charsOf)).toEqual(rows.map(([name]) => name))
  columns.forEach((column, i) => {
    expect(column.y + column.h, rows[i]![0]).toBe(zero.y)
    expect(Math.abs(column.h - (tallest * rows[i]![1]) / largest), rows[i]![0]).toBeLessThanOrEqual(1)
  })
  expect(Math.min(...layersNamed(fold, chart, "Value").map((value) => boxOf(value).y))).toBeGreaterThanOrEqual(40)
}

function lineDrawn({ answer, fold, chart }: Drawn, periods: readonly string[], series: Series) {
  expect(answer.problems).toEqual([])
  const largest = Math.max(...series.flatMap(([, values]) => values))
  const ticks = layersNamed(fold, chart, "Tick").map((node) => ({
    value: Number.parseFloat(charsOf(node)),
    y: boxOf(node).y + boxOf(node).h / 2,
  }))
  const step = ticks[1]!.value - ticks[0]!.value
  expect(ticks[0]!.value).toBe(0)
  expect(ticks.at(-1)!.value).toBeGreaterThanOrEqual(largest)
  expect(ticks.at(-1)!.value - step).toBeLessThan(largest)
  expect([1, 2, 2.5, 5]).toContain(step / 10 ** Math.floor(Math.log10(step)))
  const yOf = (value: number) => ticks[0]!.y + ((value - ticks[0]!.value) / step) * (ticks[1]!.y - ticks[0]!.y)
  const lines = layersNamed(fold, chart, "Series")
  expect(lines.map(filled)).toEqual(series.map(() => "[]"))
  for (const [s, [name, values]] of series.entries()) {
    const at = points(lines[series.length - 1 - s]!)
    expect(at, name).toHaveLength(periods.length)
    values.forEach((value, i) =>
      expect(Math.abs(at[i]!.y - yOf(value)), `${name} ${periods[i]!}`).toBeLessThanOrEqual(1),
    )
  }
  const labels = layersNamed(fold, chart, "Label").map(boxOf)
  expect(labels[0]!.y + labels[0]!.h).toBeLessThanOrEqual(labels[1]!.y)
}

function tableDrawn({ answer, fold, chart }: Drawn, rows: readonly (readonly string[])[]) {
  expect(answer.problems).toEqual([])
  const cells = doom.childrenOf(fold, chart.id).filter((node) => charsOf(node) !== "")
  const text = (chars: string) =>
    doom.propOf(
      cells.find((node) => charsOf(node) === chars),
      "text",
    )!
  for (const [name, ...numbers] of rows.slice(1, -1)) {
    expect(text(name!).paras[0]?.align, name).toBeUndefined()
    for (const number of numbers) {
      expect(text(number).paras[0]?.align, number).toBe("right")
      expect(text(number).spans[0]?.bold, number).toBe(false)
    }
  }
  for (const total of rows.at(-1)!.slice(1)) expect(text(total).spans[0]?.bold, total).toBe(true)
}

describe("each chart recipe on its sample data", () => {
  it("bar: ranked bars, each as long as its value within 1 px, one in the accent", async () => {
    barDrawn(await drawn("neutral", recipe("bar")), sample("bar", "rows"), sample("bar", "accent"))
  })

  it("column: columns on one zero line, each as tall as its value within 1 px", async () => {
    columnDrawn(await drawn("neutral", recipe("column")), sample("column", "rows"))
  })

  it("line: every point on its value within 1 px, on nice ticks", async () => {
    lineDrawn(await drawn("neutral", recipe("line")), sample("line", "periods"), sample("line", "series"))
  })

  it("table: numbers right-aligned and the total bold", async () => {
    tableDrawn(await drawn("neutral", recipe("table")), sample("table", "rows"))
  })
})

describe("each chart recipe on new data", () => {
  for (const theme of ["consulting", "midnight"]) {
    it(`bar: 7 ranked bars from 12 to 940 in ${theme}, each as long as its value within 1 px`, async () => {
      const rows: Rows = [
        ["Brazil", 12],
        ["Canada", 940],
        ["Japan", 377],
        ["Other", 55],
        ["South Africa", 61],
        ["Mexico", 503],
        ["India", 218],
      ]
      barDrawn(await drawn(theme, withData("bar", { rows, accent: "Japan" })), rows, "Japan")
    })

    it(`column: 10 periods from 12 to 940 in ${theme}, each as tall as its value within 1 px`, async () => {
      const rows: Rows = [
        ["2017", 12],
        ["2018", 48],
        ["2019", 95],
        ["2020", 61],
        ["2021", 230],
        ["2022", 377],
        ["2023", 503],
        ["2024", 618],
        ["2025", 940],
        ["2026E", 880],
      ]
      columnDrawn(await drawn(theme, withData("column", { rows, accent: "2025" })), rows)
    })

    it(`line: two series from 12 to 940 in ${theme}, every point on its value within 1 px`, async () => {
      const periods = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026E"]
      const series: Series = [
        ["Our platform", [12, 85, 140, 210, 320, 410, 560, 700, 940]],
        ["Nearest rival", [30, 60, 90, 150, 180, 260, 300, 380, 450]],
      ]
      const shown = (value: number) => `${value}`
      lineDrawn(await drawn(theme, withData("line", { periods, series, shown })), periods, series)
    })

    it(`table: new rows in ${theme}, numbers right-aligned and the total bold`, async () => {
      const rows = [
        ["Region", "Stores", "Sales, $M"],
        ["North", "212", "940.0"],
        ["South", "130", "377.5"],
        ["West", "18", "12.0"],
        ["Total", "360", "1,329.5"],
      ]
      tableDrawn(await drawn(theme, withData("table", { rows })), rows)
    })
  }
})
