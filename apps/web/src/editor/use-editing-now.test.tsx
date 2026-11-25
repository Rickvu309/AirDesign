import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { useEditingNow } from "./use-editing-now"

let window: Window & typeof globalThis

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  for (const [name, value] of [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ] as const)
    vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [{ children: [{ type: "shape", name: "Title" }] }],
})
const layer = grown.doom.children.get(grown.slides[0]!)![0]!
const now = () => 1_000

function written(fold: doom.Doom, value: string, phase?: "start"): doom.Doom {
  const next = doom.applyEdit(fold, {
    once: value,
    author: { kind: "agent", id: "claude", run: "c1" },
    writes: [{ node: layer, prop: "name", value }],
    rev: doom.rev(fold.rev + 1),
    ...(phase === undefined ? {} : { phase }),
  })
  if (doom.isRefusal(next)) throw new Error(next.refused)
  return next
}

it("shows an agent's write as editing in the render that paints it, without a second render", async () => {
  const { createRoot } = await import("react-dom/client")
  const seen: (readonly string[])[] = []
  function Probe({ view }: { readonly view: doom.Doom }) {
    seen.push([...useEditingNow(view, now)])
    return null
  }
  const root = createRoot(window.document.createElement("div"))
  const started = written(grown.doom, "A", "start")
  await act(async () => root.render(createElement(Probe, { view: started })))
  seen.length = 0

  await act(async () => root.render(createElement(Probe, { view: written(started, "B") })))
  expect(seen).toEqual([["c1"]])

  await act(async () => root.unmount())
})
