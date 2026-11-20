import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { chartLayout } from "./chart-layout.js"
import { paintStore, SlideCanvas, type CanvasChart, type CanvasElement, type CanvasText } from "./index.js"
import { textValue } from "./paragraph-edit.js"
import { presetOutline } from "./preset-path.js"

vi.mock("./preset-path.js", async (actual) => {
  const real = await actual<typeof import("./preset-path.js")>()
  return { ...real, presetOutline: vi.fn(real.presetOutline) }
})

vi.mock("./paragraph-edit.js", async (actual) => {
  const real = await actual<typeof import("./paragraph-edit.js")>()
  return { ...real, textValue: vi.fn(real.textValue) }
})

vi.mock("./chart-layout.js", async (actual) => {
  const real = await actual<typeof import("./chart-layout.js")>()
  return { ...real, chartLayout: vi.fn(real.chartLayout) }
})

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  vi.clearAllMocks()
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const title = { font: "Arial", size: 228_600, bold: true, italic: false, color: null }
const body = { font: "Arial", size: 177_800, bold: false, italic: false, color: null }
const words: CanvasText = {
  paragraphs: [
    { from: 0, align: "center", runs: [{ from: 0, text: "Card 1", ...title }], endStyle: title },
    { from: 1, align: "center", runs: [{ from: 0, text: "Revenue grew in every region", ...body }], endStyle: body },
  ],
  anchor: "middle",
  insets: { left: 91_440, top: 45_720, right: 91_440, bottom: 45_720 },
  wrap: true,
  fit: { kind: "shrink", scale: 0.925, reduction: 0.1 },
}
const card: CanvasElement = {
  key: "card",
  id,
  kind: "shape",
  box: { x: 457_200, y: 457_200, width: 2_000_000, height: 1_150_000, rotation: 0, flipH: false, flipV: false },
  editable: true,
  movable: true,
  placeholder: false,
  filled: true,
  fill: "steelblue",
  line: { color: "black", width: 12_700, dash: null },
  outline: "box",
  geometry: { preset: "roundRect", adjusts: {} },
  text: words,
}
const pieId = elementId("256.3")
const pie: CanvasChart = {
  kind: "pie",
  grouping: "clustered",
  hole: 0,
  firstAngle: 0,
  gap: 1.5,
  overlap: 0,
  categories: ["Owners", "Renters"],
  series: [
    {
      name: "Tenure",
      values: [0.4, 0.6],
      texts: ["40%", "60%"],
      points: [
        { fill: "steelblue", line: null },
        { fill: "navy", line: null },
      ],
      stroke: null,
      marker: false,
      labels: [],
    },
  ],
  title: null,
  legend: null,
  fill: null,
  line: null,
  plot: null,
  valueAxis: null,
  categoryAxis: null,
}
const chart: CanvasElement = {
  key: "chart",
  id: pieId,
  kind: "chart",
  box: { x: 6_096_000, y: 457_200, width: 3_000_000, height: 2_400_000, rotation: 0, flipH: false, flipV: false },
  editable: false,
  movable: true,
  placeholder: false,
  filled: false,
  fill: null,
  line: null,
  outline: "box",
  text: null,
  chart: pie,
}
const lineId = elementId("256.4")
const tiedLine: CanvasElement = {
  key: "line",
  id: lineId,
  kind: "connector",
  box: { x: 1_457_200, y: 1_607_200, width: 0, height: 900_000, rotation: 0, flipH: false, flipV: false },
  editable: false,
  movable: true,
  placeholder: false,
  filled: false,
  fill: null,
  line: { color: "black", width: 19_050, dash: null },
  outline: "line",
  geometry: { preset: "straightConnector1", adjusts: {} },
  connection: { start: { node: id, site: 2 }, end: null },
  text: null,
}
const stored = JSON.stringify([
  { from: 0, runs: [{ from: 0, text: "Card 1" }] },
  { from: 1, runs: [{ from: 0, text: "Revenue grew in every region" }] },
])
const moved = (step: number) => ({
  x: 457_200 + step * 152_400,
  y: 457_200 + step * 76_200,
  cx: 2_000_000,
  cy: 1_150_000,
})

async function painted() {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: stored })
  store.publish({ id: pieId, kind: "chart", text: "" })
  store.publish({ id: lineId, kind: "connector", text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [card, chart, tiedLine] },
        width: 800,
        onBoxes: () => undefined,
        onEdit: () => undefined,
      }),
    )
  })
  return { store, host }
}

function restyles(host: HTMLElement) {
  const changed: string[] = []
  const watch = new MutationObserver((list) => {
    for (const each of list) {
      const target = each.target
      if (target instanceof HTMLElement && (target.dataset.paragraph !== undefined || target.dataset.run !== undefined))
        changed.push(target.dataset.paragraph === undefined ? "run" : "paragraph")
    }
  })
  const text = host.querySelector("[data-text-body]")
  if (text === null) throw new Error("the card painted no text")
  watch.observe(text, { attributes: true, subtree: true })
  return () => {
    changed.push(...watch.takeRecords().map(() => "late"))
    watch.disconnect()
    return changed
  }
}

describe("work a move does", () => {
  it("restyles none of a moved card's paragraphs or runs", async () => {
    const { store, host } = await painted()
    const stop = restyles(host)
    const grip = store.gripBox(id)
    for (const step of [1, 2, 3])
      await act(async () => {
        grip.place(moved(step))
      })
    expect(stop()).toEqual([])
    grip.keep()
  })

  it("computes no outline for a card that moves, and one when it is resized", async () => {
    const { store } = await painted()
    vi.mocked(presetOutline).mockClear()
    const cardOutlines = () => vi.mocked(presetOutline).mock.calls.filter(([preset]) => preset === "roundRect")
    const grip = store.gripBox(id)
    for (const step of [1, 2, 3])
      await act(async () => {
        grip.place(moved(step))
      })
    expect(cardOutlines()).toEqual([])
    await act(async () => {
      grip.place({ ...moved(3), cx: 2_400_000 })
    })
    expect(cardOutlines()).toHaveLength(1)
    grip.keep()
  })

  it("reads no stored text when a card and the connector tied to it move", async () => {
    const { store } = await painted()
    vi.mocked(textValue).mockClear()
    const grip = store.gripBox(id)
    for (const step of [1, 2, 3])
      await act(async () => {
        grip.place(moved(step))
      })
    expect(textValue).not.toHaveBeenCalled()
    grip.keep()
  })

  it("lays out no chart when a chart moves, and lays it out once when it is resized", async () => {
    const { store } = await painted()
    vi.mocked(chartLayout).mockClear()
    const grip = store.gripBox(pieId)
    for (const step of [1, 2, 3])
      await act(async () => {
        grip.place({ x: 6_096_000 - step * 152_400, y: 457_200 + step * 76_200, cx: 3_000_000, cy: 2_400_000 })
      })
    expect(chartLayout).not.toHaveBeenCalled()
    await act(async () => {
      grip.place({ x: 5_000_000, y: 900_000, cx: 3_300_000, cy: 2_400_000 })
    })
    expect(chartLayout).toHaveBeenCalledTimes(1)
    grip.keep()
  })
})
