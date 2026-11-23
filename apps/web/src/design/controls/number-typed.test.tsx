import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { textCopy } from "@/copy/text-copy"
import { resolveControl } from "@/design/panel-arrangement"
import type { PanelControl } from "@/design/panel"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let NumberField: typeof import("./number").NumberField

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  NumberField = (await import("./number")).NumberField
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function lineHeight(value: number): PanelControl {
  return {
    ...resolveControl({
      trait: "text",
      field: "lineHeight",
      label: textCopy.lineHeight,
      desc: { kind: "number", unit: "fraction", min: 10_000, max: 1_000_000 },
      value,
      mixed: false,
      inherited: false,
      reset: null,
    }),
    typed: { auto: 100, points: 100 / 24 },
  }
}

it("reads a typed percent, points or Auto on Enter", async () => {
  const sent: unknown[] = []
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      createElement(NumberField, {
        control: lineHeight(150_000),
        palette: { templateColors: [], deck: [] },
        onChange: (value) => void sent.push(value),
        unit: designCopy.percent,
        kind: "length",
      }),
    )
  })
  const input = host.querySelector("input")
  if (input === null) throw new Error("no field")
  for (const typed of ["120%", "24pt", textCopy.auto]) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, typed)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
  }
  expect(sent).toEqual([120_000, 100_000, 100_000])
  await act(async () => root.unmount())
  host.remove()
})

it("keeps a line height typed in points as points, and shows it in points", async () => {
  const sent: unknown[] = []
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const render = async (value: unknown) =>
    act(async () => {
      root.render(
        createElement(NumberField, {
          control: { ...lineHeight(150_000), value, typed: { auto: 100, points: 100 / 24, fixed: true } },
          palette: { templateColors: [], deck: [] },
          onChange: (next) => void sent.push(next),
          unit: designCopy.percent,
          kind: "length",
        }),
      )
    })
  await render(150_000)
  const input = host.querySelector("input")
  if (input === null) throw new Error("no field")
  const type = async (typed: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, typed)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
  }
  await type("24pt")
  expect(sent).toEqual([{ points: 2400 }])
  await render({ points: 2400 })
  expect(input.value).toBe("24")
  expect(host.textContent).toContain(designCopy.points)
  await type("30")
  await type("120%")
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }))
  })
  expect(sent).toEqual([{ points: 2400 }, { points: 3000 }, 120_000, { points: 2500 }])
  await act(async () => root.unmount())
  host.remove()
})
