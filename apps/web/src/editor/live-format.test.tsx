import { elementId } from "@airdesign/document"
import { textFormatting, type TextFormatting } from "@airdesign/render"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { useLiveFormat } from "@/editor/format-buttons"

let window: Window & typeof globalThis

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

type Target = Parameters<TextFormatting["register"]>[1]

function targetWith(held: { bold: "on" | "off"; size: number }): Target {
  return {
    link: () => null,
    linkTo: () => undefined,
    selection: () => false,
    edits: () => true,
    state: (format) => (format === "bold" ? held.bold : "off"),
    apply: () => undefined,
    size: () => held.size,
    resize: () => undefined,
    sizeTo: () => undefined,
    color: () => null,
    choose: () => undefined,
    align: () => "left",
    place: () => undefined,
    bullet: () => "off",
    bullets: () => undefined,
    swatches: () => [],
  }
}

it("paints the format controls again only when the shown format changes, not on every caret move", async () => {
  const formatting = textFormatting()
  const held = { bold: "off" as "on" | "off", size: 18 }
  const id = elementId("256.4")
  formatting.register(id, targetWith(held))
  formatting.aim(id)
  const seen: (string | number | null)[] = []
  function Controls() {
    const live = useLiveFormat(formatting)
    seen.push(`${live?.shown.bold ?? "none"} ${String(live?.size ?? null)}`)
    return null
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<Controls />))
  const painted = seen.length

  for (let moved = 0; moved < 5; moved += 1) await act(async () => formatting.changed())
  expect(seen).toHaveLength(painted)

  held.bold = "on"
  await act(async () => formatting.changed())
  expect(seen.at(-1)).toBe("on 18")
  held.size = 24
  await act(async () => formatting.changed())
  expect(seen.at(-1)).toBe("on 24")

  await act(async () => root.unmount())
  host.remove()
})

it("says which layer the format controls are aimed at, and none once aim is dropped", () => {
  const formatting = textFormatting()
  const id = elementId("256.4")
  expect(formatting.aimed()).toBeNull()
  formatting.register(id, targetWith({ bold: "off", size: 18 }))
  formatting.aim(id)
  expect(formatting.aimed()).toBe(id)
  formatting.aim(null)
  expect(formatting.aimed()).toBeNull()
})
