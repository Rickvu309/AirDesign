import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, unshownFill, type CanvasChart, type CanvasElement } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.11")
const flat = { rotation: 0, flipH: false, flipV: false }
const look = { size: 11.97, bold: false, color: "rgb(64, 64, 64)", font: "Calibri" }
const label = (text: string) => ({ text, look, position: "outsideEnd" as const, dx: 0, dy: 0 })

const tenure: CanvasChart = {
  kind: "pie",
  grouping: "clustered",
  hole: 0,
  firstAngle: 0,
  gap: 1.5,
  overlap: 0,
  categories: ["Owner with mortgage", "Owner, no mortgage", "Renter"],
  series: [
    {
      name: "Housing Tenure Status",
      values: [0.2483663, 0.1549955, 0.5966382],
      texts: ["25%", "15%", "60%"],
      points: ["rgb(44, 86, 122)", "rgb(0, 114, 199)", "rgb(13, 29, 81)"].map((fill) => ({
        fill,
        line: { color: "rgb(255, 255, 255)", width: 1.5 },
      })),
      stroke: null,
      marker: false,
      labels: [label("Owner with mortgage; 25%"), label("Owner, no mortgage; 15%"), label("Renter; 60%")],
    },
  ],
  title: { text: "Housing Tenure Status", look: { ...look, size: 18.62, color: "rgb(89, 89, 89)" } },
  legend: null,
  fill: null,
  line: { color: "rgb(44, 86, 122)", width: 0.75 },
  plot: null,
  valueAxis: null,
  categoryAxis: null,
}

function frame(chart: CanvasChart | undefined, placeholder = false): CanvasElement {
  return {
    key: id,
    id,
    kind: "chart",
    box: { x: 0, y: 1_690_688, width: 4_398_818, height: 3_976_687, ...flat },
    editable: false,
    placeholder,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...(chart === undefined ? {} : { chart }),
  }
}

async function painted(elements: readonly CanvasElement[], quiet = false): Promise<HTMLElement> {
  const store = paintStore()
  store.publish({ id, kind: "chart", text: "", picture: null })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide = { width: 12_192_000, height: 6_858_000, background: null, elements }
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width: 960, quiet }))
  })
  return host
}

const held = (host: HTMLElement) => host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)

it("paints the chart's slices, title and labels inside its frame instead of the box it cannot show", async () => {
  const host = await painted([frame(tenure)])
  const chart = held(host)
  expect(chart?.style.background).not.toBe(unshownFill)
  expect(chart?.querySelector("[data-unshown-label]")).toBeNull()
  expect(chart?.querySelectorAll("svg[data-chart=pie] path")).toHaveLength(3)
  expect(chart?.querySelector('[data-chart-text="title"]')?.textContent).toBe("Housing Tenure Status")
  expect(chart?.querySelector('[data-chart-text="label 0 2"]')?.textContent).toBe("Renter; 60%")
  expect(chart?.querySelectorAll('[data-chart-text="label 0 0"] tspan')).toHaveLength(2)
  const svg = chart?.querySelector("svg")
  expect(Number(svg?.getAttribute("width"))).toBeCloseTo((4_398_818 / 12_192_000) * 960, 3)
  expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${4_398_818 / 12_700} ${3_976_687 / 12_700}`)
})

it("gives a screen reader the chart's type, title and data", async () => {
  const host = await painted([frame(tenure)])
  const svg = held(host)?.querySelector("svg")
  expect(svg?.getAttribute("role")).toBe("img")
  expect(svg?.getAttribute("aria-label")).toBe("Pie chart: Housing Tenure Status")
  expect(svg?.querySelector("desc")?.textContent).toBe(
    "Housing Tenure Status: Owner with mortgage 25%; Owner, no mortgage 15%; Renter 60%.",
  )
})

it("offers nothing to edit inside a chart", async () => {
  const host = await painted([frame(tenure)])
  expect(held(host)?.querySelector('[contenteditable="true"]')).toBeNull()
  expect(held(host)?.querySelector("svg")?.style.pointerEvents).toBe("none")
})

it("paints the chart in a thumbnail and keeps it out of the screen reader's way there", async () => {
  const host = await painted([frame(tenure)], true)
  const thumb = host.querySelector("[data-thumb-paint]")
  expect(thumb?.querySelectorAll("svg[data-chart=pie] path")).toHaveLength(3)
  expect(thumb?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  expect(thumb?.querySelector("desc")).toBeNull()
})

it("keeps the box it cannot show for a chart it could not read", async () => {
  const host = await painted([frame(undefined)])
  expect(held(host)?.style.background).toBe(unshownFill)
  expect(held(host)?.querySelector("svg[data-chart]")).toBeNull()
})

it("draws no empty placeholder outline around a chart that fills its placeholder", async () => {
  const host = await painted([frame(tenure, true)])
  expect(held(host)?.style.outline).toBe("")
})
