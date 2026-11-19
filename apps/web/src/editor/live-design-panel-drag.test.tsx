import { elementId, openRegister, type ElementId } from "@airdesign/document"
import { readParts, readSlides } from "@airdesign/pptx"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { boxCopy } from "@/copy/box-copy"
import type { DeckPaint } from "./use-deck-paint"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

let window: Window & typeof globalThis
let editor: {
  readonly createRoot: typeof import("react-dom/client").createRoot
  readonly LiveDesignPanel: typeof import("./live-design-panel").LiveDesignPanel
  readonly useDeckPaint: typeof import("./use-deck-paint").useDeckPaint
  readonly useUndoList: typeof import("./use-undo").useUndoList
}

function Panel(props: { readonly nodes: readonly ElementId[]; readonly exposed: (shown: DeckPaint) => void }) {
  const nothing = () => undefined
  const pictures = { store: { bytes: new Map(), load: async () => false, keep: nothing } }
  const undo = editor.useUndoList()
  const shown = editor.useDeckPaint("drag-deck", pictures, { show: nothing })
  props.exposed(shown)
  return createElement(editor.LiveDesignPanel, {
    mode: "design",
    deck: {
      id: "drag-deck",
      shown,
      undo,
      selection: { ids: props.nodes, inside: null },
      record: nothing,
      settle: nothing,
    },
  })
}

async function fixture(name: string): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url))
}

async function panelOn(file: string, shapes: readonly number[]) {
  const parts = await readParts(await fixture(file))
  const slide = readSlides(parts)[0]?.slide
  if (slide === undefined) throw new Error("no slide")
  const nodes = shapes.map((shape) => elementId(`${slide}.${String(shape)}`))
  const register = openRegister("", "")
  device.link = {
    enqueueRow: async () => ({ ok: true }),
    flush: async () => ({ ok: true }),
    openDeck: async () => ({ ok: true, register }),
  }
  const exposed: { current: DeckPaint | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = editor.createRoot(host)
  await act(async () => root.render(createElement(Panel, { nodes, exposed: (now) => (exposed.current = now) })))
  const shown = exposed.current
  if (shown === null) throw new Error("not rendered")
  await act(async () => {
    shown.showOpened(parts, register)
  })
  await act(async () => {
    const fold = [...host.querySelectorAll("button")].find((button) => button.textContent === boxCopy.section)
    if (fold === undefined) throw new Error(boxCopy.section)
    if (fold.getAttribute("aria-expanded") !== "true") fold.click()
  })
  const store = shown.store.current
  const reads = { count: 0 }
  const read = store.getElement
  Object.assign(store, {
    getElement: (id: ElementId) => {
      reads.count += 1
      return read(id)
    },
  })
  const field = (name: string) => {
    const input = host.querySelector<HTMLInputElement>(`[data-design-element] input[aria-label="${name}"]`)
    if (input === null) throw new Error(name)
    return input.value
  }
  return {
    nodes,
    store,
    reads,
    field,
    close: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

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
    ["HTMLInputElement", window.HTMLInputElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["KeyboardEvent", window.KeyboardEvent],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  const [{ createRoot }, { LiveDesignPanel }, { useDeckPaint }, { useUndoList }] = await Promise.all([
    import("react-dom/client"),
    import("./live-design-panel"),
    import("./use-deck-paint"),
    import("./use-undo"),
  ])
  editor = { createRoot, LiveDesignPanel, useDeckPaint, useUndoList }
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }

it("shows X and Y following a drag without rebuilding the panel, and the whole panel once the drag lands", async () => {
  const panel = await panelOn("clean.pptx", [2])
  const [node] = panel.nodes
  if (node === undefined) throw new Error("no node")
  const x = panel.field(boxCopy.x)
  const y = panel.field(boxCopy.y)
  const width = panel.field(boxCopy.w)
  panel.reads.count = 0
  const grip = panel.store.gripBox(node)
  await act(async () => {
    grip.place({ ...start, x: start.x + 914_400 })
  })
  await act(async () => {
    grip.place({ ...start, x: start.x + 1_828_800, y: start.y + 914_400 })
  })
  expect(panel.reads.count).toBe(0)
  expect(panel.field(boxCopy.x)).not.toBe(x)
  expect(panel.field(boxCopy.y)).not.toBe(y)
  expect(panel.field(boxCopy.w)).toBe(width)
  const dragged = [panel.field(boxCopy.x), panel.field(boxCopy.y)]
  await act(async () => {
    grip.keep()
  })
  expect(panel.reads.count).toBeGreaterThan(0)
  expect([panel.field(boxCopy.x), panel.field(boxCopy.y)]).toEqual(dragged)
  await panel.close()
})

it("keeps a Mixed X while several layers move, without rebuilding the panel", async () => {
  const panel = await panelOn("connectors.pptx", [2, 3])
  expect(panel.field(boxCopy.x)).toBe("")
  panel.reads.count = 0
  const files = [
    { x: 1_524_000, y: 2_286_000, cx: 2_286_000, cy: 1_143_000 },
    { x: 5_334_000, y: 3_810_000, cx: 2_286_000, cy: 1_143_000 },
  ]
  const grips = panel.nodes.map((node) => panel.store.gripBox(node))
  await act(async () => {
    grips.forEach((grip, at) => {
      const box = files[at] ?? start
      grip.place({ ...box, x: box.x + 914_400 })
    })
  })
  expect(panel.reads.count).toBe(0)
  expect(panel.field(boxCopy.x)).toBe("")
  await act(async () => {
    for (const grip of grips) grip.keep()
  })
  expect(panel.reads.count).toBeGreaterThan(0)
  await panel.close()
})
