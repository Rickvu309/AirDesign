import * as doom from "@airdesign/doom"
import { guide, piece } from "@airdesign/taste"
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

const given = (script: string, name: string, value: unknown) => {
  const lines = script.split("\n")
  const first = lines.findIndex((line) => line.startsWith(`const ${name} = `))
  expect(first, name).toBeGreaterThanOrEqual(0)
  const after = lines.findIndex((line, at) => at > first && /^\S/.test(line) && !/^[\])}]/.test(line))
  const code = typeof value === "function" ? String(value) : JSON.stringify(value)
  return [...lines.slice(0, first), `const ${name} = ${code}`, ...lines.slice(after)].join("\n")
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

function treeOf(fold: doom.Doom, node: doom.Node): doom.TreeNode {
  const { id: _id, rev: _rev, type, parent: _parent, name, ...props } = node as doom.Node & Record<string, unknown>
  const children = doom.childrenOf(fold, node.id).map((child) => treeOf(fold, child))
  return {
    type: type as doom.TreeNode["type"],
    ...(name === undefined ? {} : { name: name as string }),
    props: props as never,
    ...(children.length === 0 ? {} : { children }),
  }
}

const pieceOf = (fold: doom.Doom, chart: doom.Node): doom.TreeNode => {
  const tree = treeOf(fold, chart)
  const props = tree.props as { box: Record<string, unknown> }
  return { ...tree, props: { ...props, box: { ...props.box, x: 0, y: 0 } } as never }
}

describe("chart recipes draw the kit's charts", () => {
  for (const [kind, name] of [
    ["table", "table"],
    ["bar", "bar-chart"],
    ["column", "column-chart"],
    ["line", "line-chart"],
    ["donut", "donut-chart"],
  ] as const)
    it(`draws kit/${name} from the ${kind} recipe's sample data`, async () => {
      const { answer, fold, chart } = await drawn("neutral", recipe(kind))
      expect(answer.problems).toEqual([])
      expect(pieceOf(fold, chart)).toEqual(piece(name)?.tree)
    })
})

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

describe("each recipe on new data", () => {
  for (const theme of ["consulting", "midnight"]) {
    it(`bar: 7 ranked bars from 12 to 940 in ${theme}, each as long as its value within 1 px`, async () => {
      const rows = [
        ["Brazil", 12],
        ["Canada", 940],
        ["Japan", 377],
        ["Other", 55],
        ["South Africa", 61],
        ["Mexico", 503],
        ["India", 218],
      ] as const
      const { answer, fold, chart } = await drawn(theme, withData("bar", { rows, accent: "Japan" }))
      expect(answer.problems).toEqual([])
      const names = layersNamed(fold, chart, "Name").map(charsOf)
      expect(names).toEqual(["Canada", "Mexico", "Japan", "India", "South Africa", "Brazil", "Other"])
      const bars = layersNamed(fold, chart, "Bar")
      const values = layersNamed(fold, chart, "Value").map(boxOf)
      expect(values[0]!.x + values[0]!.w).toBe(boxOf(chart).w)
      const track = boxOf(bars[0]!).w
      names.forEach((name, i) => {
        const value = rows.find(([label]) => label === name)![1]
        expect(Math.abs(boxOf(bars[i]!).w - (track * value) / 940), name).toBeLessThanOrEqual(1)
        expect(boxOf(bars[i]!).x).toBe(boxOf(bars[0]!).x)
      })
      expect(bars.map(filled).map((fill) => fill.includes("accent1"))).toEqual([
        false,
        false,
        true,
        false,
        false,
        false,
        false,
      ])
    })

    it(`column: 10 periods from 12 to 940 in ${theme}, each as tall as its value within 1 px`, async () => {
      const rows = [
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
      ] as const
      const { answer, fold, chart } = await drawn(theme, withData("column", { rows, accent: "2025" }))
      expect(answer.problems).toEqual([])
      const columns = layersNamed(fold, chart, "Column").map(boxOf)
      const zero = boxOf(layersNamed(fold, chart, "Zero line")[0]!)
      const tallest = Math.max(...columns.map((column) => column.h))
      expect(layersNamed(fold, chart, "Name").map(charsOf)).toEqual(rows.map(([name]) => name))
      columns.forEach((column, i) => {
        expect(column.y + column.h, rows[i]![0]).toBe(zero.y)
        expect(Math.abs(column.h - (tallest * rows[i]![1]) / 940), rows[i]![0]).toBeLessThanOrEqual(1)
      })
      expect(Math.min(...layersNamed(fold, chart, "Value").map((value) => boxOf(value).y))).toBeGreaterThanOrEqual(40)
    })

    it(`line: two series from 12 to 940 in ${theme}, every point on its value within 1 px`, async () => {
      const periods = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026E"]
      const series = [
        ["Our platform", [12, 85, 140, 210, 320, 410, 560, 700, 940]],
        ["Nearest rival", [30, 60, 90, 150, 180, 260, 300, 380, 450]],
      ]
      const shown = (value: number) => `${value}`
      const { answer, fold, chart } = await drawn(theme, withData("line", { periods, series, shown }))
      expect(answer.problems).toEqual([])
      const ticks = layersNamed(fold, chart, "Tick").map((node) => ({
        value: Number(charsOf(node)),
        y: boxOf(node).y + boxOf(node).h / 2,
      }))
      const step = ticks[1]!.value - ticks[0]!.value
      expect(ticks[0]!.value).toBe(0)
      expect(ticks.at(-1)!.value).toBeGreaterThanOrEqual(940)
      expect(ticks.at(-1)!.value - step).toBeLessThan(940)
      expect([1, 2, 2.5, 5]).toContain(step / 10 ** Math.floor(Math.log10(step)))
      const yOf = (value: number) => ticks[0]!.y + ((value - ticks[0]!.value) / step) * (ticks[1]!.y - ticks[0]!.y)
      const lines = layersNamed(fold, chart, "Series")
      expect(lines.map(filled)).toEqual(["[]", "[]"])
      for (const [s, [name, values]] of series.entries()) {
        const path = lines[series.length - 1 - s]!
        const at = points(path)
        expect(at, String(name)).toHaveLength(periods.length)
        ;(values as number[]).forEach((value, i) =>
          expect(Math.abs(at[i]!.y - yOf(value)), `${String(name)} ${periods[i]!}`).toBeLessThanOrEqual(1),
        )
      }
      const labels = layersNamed(fold, chart, "Label").map(boxOf)
      expect(labels[0]!.y + labels[0]!.h).toBeLessThanOrEqual(labels[1]!.y)
    })

    it(`donut: five parts in ${theme}, each slice's angle its share, shares adding up to 100`, async () => {
      const rows = [
        ["Wholesale", 377],
        ["Other", 12],
        ["Retail", 940],
        ["Online", 218],
        ["Licensing", 61],
      ] as const
      const { answer, fold, chart } = await drawn(theme, withData("donut", { rows, accent: "Retail" }))
      expect(answer.problems).toEqual([])
      expect(layersNamed(fold, chart, "Part").map(charsOf)).toEqual([
        "58% Retail",
        "23% Wholesale",
        "14% Online",
        "4% Licensing",
        "1% Other",
      ])
      const slices = layersNamed(fold, chart, "Slice")
      const radius = boxOf(slices[0]!).w / 2
      const starts = slices.map((slice) => {
        const [first] = points(slice)
        const box = boxOf(slice)
        return Math.atan2(first!.y - box.y - radius, first!.x - box.x - radius)
      })
      const turn = (angle: number) => (angle + 4 * Math.PI) % (2 * Math.PI)
      ;[940, 377, 218, 61].forEach((value, i) =>
        expect(Math.abs(turn(starts[i + 1]! - starts[i]!) - (value / 1608) * 2 * Math.PI) * radius).toBeLessThanOrEqual(
          1,
        ),
      )
      expect(slices.map(filled).map((fill) => fill.includes("accent1"))).toEqual([true, false, false, false, false])
    })

    it(`table: new rows in ${theme}, numbers right-aligned and the total bold`, async () => {
      const rows = [
        ["Region", "Stores", "Sales, $M"],
        ["North", "212", "940.0"],
        ["South", "130", "377.5"],
        ["West", "18", "12.0"],
        ["Total", "360", "1,329.5"],
      ]
      const { answer, fold, chart } = await drawn(theme, withData("table", { rows }))
      expect(answer.problems).toEqual([])
      const cells = doom.childrenOf(fold, chart.id).filter((node) => charsOf(node) !== "")
      const cell = (chars: string) =>
        doom.propOf(
          cells.find((node) => charsOf(node) === chars),
          "text",
        )!
      expect(cell("940.0").paras[0]?.align).toBe("right")
      expect(cell("North").paras[0]?.align).toBeUndefined()
      expect(cell("1,329.5").spans[0]?.bold).toBe(true)
      expect(cell("377.5").spans[0]?.bold).toBe(false)
    })
  }
})
