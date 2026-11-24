import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { editorCopy } from "@/copy/editor-copy"
import { fillCopy } from "@/copy/fill-copy"
import { designCopy } from "@/copy/design-copy"
import { panelSections } from "@/design/panel-order"
import { ChartSection } from "./design-chart"
import { DesignPanel } from "./design-panel"
import { kindOf, nodeModel } from "./design-model"
import { panelTitle } from "./panel-title"
import type { EditorClient } from "./use-deck"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    navigator: window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const chart = {
  kind: "bar" as const,
  categories: ["Current DSO", "Q4 target"],
  series: [{ name: "Days sales outstanding", values: [52, 40] }],
  labels: true,
}

const box = { x: 0, y: 0, w: 400, h: 200, rotation: 0, flipH: false, flipV: false }
const fills = [{ kind: "solid" as const, color: { var: "background2" as const } }]

const built = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [
    {
      children: [
        { type: "frame", name: "plain", props: { box, fills } },
        {
          type: "frame",
          props: { box: { ...box, y: 300, w: 640, h: 360 }, fills, chart },
        },
      ],
    },
  ],
})

const theme = doom.defaultTheme
const slides = built.slides
const view = built.doom
const plainId = built.ids.plain!
const nextId = (id: doom.NodeId) => doom.nodeId(`n:${String(Number(id.slice(2)) + 1)}`)
const chartId = nextId(plainId)

function modelOf(id: doom.NodeId) {
  return nodeModel({ view, id, theme, slides })
}

it("names a chart Chart, and a plain frame Frame", () => {
  expect(kindOf(view, chartId)).toBe("chart")
  expect(kindOf(view, plainId)).toBe("frame")
  expect(panelTitle(modelOf(chartId))).toBe(editorCopy.chart)
  expect(panelTitle(modelOf(plainId))).toBe(designCopy.panels.frame)
  expect(panelSections("chart")).toEqual(panelSections("frame"))
  expect(modelOf(chartId).sections.map((section) => section.trait)).toEqual(
    expect.arrayContaining(["fills", "opacity", "corners", "border", "shadow"]),
  )
})

async function shown(node: ReturnType<typeof createElement>) {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(node))
  return {
    host,
    stop: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

it("puts the chart's own section before Fill and titles the panel Chart", async () => {
  const client = { deck: "deck", view: () => view, push: () => undefined } as unknown as EditorClient
  const { host, stop } = await shown(
    createElement(DesignPanel, {
      deck: "deck",
      client,
      view,
      slide: slides[0]!,
      slideNumber: 1,
      selection: { ids: [chartId], inside: null },
      onSelection: () => undefined,
      words: null,
      onLinkWords: () => undefined,
      onCrop: () => undefined,
    }),
  )
  try {
    const marks = [...host.querySelectorAll("[data-design-head], [data-panel-section='chart'], [data-design-section]")]
    const order = marks.map((mark) => {
      if (mark.hasAttribute("data-design-head")) return `title:${mark.textContent?.trim()}`
      const section = mark.getAttribute("data-panel-section")
      return section ?? mark.getAttribute("data-design-section")
    })
    const title = order.indexOf(`title:${editorCopy.chart}`)
    const chartAt = order.indexOf("chart")
    const fillAt = order.indexOf(fillCopy.section)
    expect(title).toBeGreaterThanOrEqual(0)
    expect(order.filter((name) => name === "chart")).toEqual(["chart"])
    expect(chartAt).toBeGreaterThan(title)
    expect(fillAt).toBeGreaterThan(chartAt)
  } finally {
    await stop()
  }
})

it("shows a long category and series name in full, wrapping inside the panel", async () => {
  const { host, stop } = await shown(createElement(ChartSection, { id: chartId, view, push: () => undefined }))
  try {
    const category = host.querySelector(`[aria-label="${editorCopy.chartData} 1"]`)
    const series = host.querySelector(`[aria-label="${editorCopy.seriesName(1)}"]`)
    expect(category?.tagName).toBe("TEXTAREA")
    expect(series?.tagName).toBe("TEXTAREA")
    expect((category as HTMLTextAreaElement | null)?.value).toBe("Current DSO")
    expect((series as HTMLTextAreaElement | null)?.value).toBe("Days sales outstanding")
    const tokens = (node: Element | null | undefined) => (node?.className ?? "").split(/\s+/)
    for (const field of [category, series]) {
      expect(tokens(field)).not.toContain("h-8")
      expect(tokens(field?.parentElement)).not.toContain("h-8")
      expect(tokens(field)).toEqual(expect.arrayContaining(["break-words", "field-sizing-content"]))
    }
    const data = host.querySelector("[data-chart-data]")
    const grid = data?.querySelector("[style]") ?? data
    expect(grid?.getAttribute("style") ?? "").toContain("5rem minmax(max(4.5rem, ")
  } finally {
    await stop()
  }
})

const wide = {
  kind: "column" as const,
  categories: ["A very long category name that keeps going", "Second"],
  series: ["One of the long series names", "Two", "Three", "Four", "Five"].map((name) => ({
    name,
    values: [1234.5, 6],
  })),
}

it("keeps a minimum width for the labels and numbers, and scrolls sideways with many series", async () => {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [{ children: [{ type: "frame", name: "wide", props: { box, fills, chart: wide } }] }],
  })
  const wideView = grown.doom
  const wideId = grown.ids.wide!
  const { host, stop } = await shown(createElement(ChartSection, { id: wideId, view: wideView, push: () => undefined }))
  try {
    const data = host.querySelector("[data-chart-data]")
    expect(data?.className ?? "").toContain("overflow-x-auto")
    const columns = data?.querySelector("[style]")?.getAttribute("style") ?? ""
    expect(columns).toContain("5rem minmax(max(4.5rem, 7ch + 1.75rem), auto)")
    const header = host.querySelector(`[aria-label="${editorCopy.seriesName(1)}"]`)
    expect(header?.tagName).toBe("INPUT")
    expect(header?.getAttribute("title")).toBe("One of the long series names")
  } finally {
    await stop()
  }
})
