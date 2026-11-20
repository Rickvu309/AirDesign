import { elementId, type ElementId, type StackMove } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useLayerKeys } from "@/editor/layer-keys"
import { LayersPanel, type RenameRequest } from "@/editor/layers-panel"
import type { Layer } from "@/editor/layer-tree"

let domWindow: Window & typeof globalThis
const hosts: { host: HTMLDivElement; root: Root }[] = []

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  domWindow = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  domWindow.Element.prototype.scrollIntoView = () => undefined
  const shared: [string, unknown][] = [
    ["window", domWindow],
    ["document", domWindow.document],
    ["HTMLElement", domWindow.HTMLElement],
    ["Element", domWindow.Element],
    ["Node", domWindow.Node],
    ["InputEvent", domWindow.InputEvent],
    ["KeyboardEvent", domWindow.KeyboardEvent],
    ["Event", domWindow.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
  domWindow.close()
})

function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...init })
  target.dispatchEvent(event)
  return event
}

describe("useLayerKeys", () => {
  it("intercepts Cmd or Ctrl+R only when a layer can rename, leaving reload alone when nothing is selected", async () => {
    let renames = 0
    let canRename = true
    const flags: string[] = []
    function Harness() {
      useLayerKeys(true, {
        onFlag: (flag) => flags.push(flag),
        onRename: () => {
          if (!canRename) return false
          renames += 1
          return true
        },
      })
      return null
    }
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(createElement(Harness))
    })
    const ctrl = keydown(window, "r", { code: "KeyR", ctrlKey: true })
    expect(ctrl.defaultPrevented).toBe(true)
    expect(renames).toBe(1)
    const cmd = keydown(window, "r", { code: "KeyR", metaKey: true })
    expect(cmd.defaultPrevented).toBe(true)
    expect(renames).toBe(2)
    const hard = keydown(window, "R", { code: "KeyR", ctrlKey: true, shiftKey: true })
    expect(hard.defaultPrevented).toBe(false)
    expect(renames).toBe(2)
    canRename = false
    const reload = keydown(window, "r", { code: "KeyR", ctrlKey: true })
    expect(reload.defaultPrevented).toBe(false)
    expect(renames).toBe(2)
    canRename = true
    const input = document.createElement("input")
    host.append(input)
    const typed = keydown(input, "r", { code: "KeyR", ctrlKey: true })
    expect(typed.defaultPrevented).toBe(false)
    expect(renames).toBe(2)
    const hide = keydown(window, "H", { code: "KeyH", ctrlKey: true, shiftKey: true })
    expect(hide.defaultPrevented).toBe(true)
    expect(flags).toEqual(["hidden"])
  })

  it("ignores Cmd or Ctrl+R while a dialog, grid view, or inert presentation is open", async () => {
    let renames = 0
    function Harness() {
      useLayerKeys(true, {
        onFlag: () => undefined,
        onRename: () => {
          renames += 1
          return true
        },
      })
      return null
    }
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(createElement(Harness))
    })
    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    dialog.setAttribute("data-open", "")
    host.append(dialog)
    expect(keydown(window, "r", { code: "KeyR", ctrlKey: true }).defaultPrevented).toBe(false)
    dialog.remove()
    const grid = document.createElement("div")
    grid.setAttribute("data-grid-viewport", "")
    host.append(grid)
    expect(keydown(window, "r", { code: "KeyR", ctrlKey: true }).defaultPrevented).toBe(false)
    grid.remove()
    const stage = document.createElement("div")
    stage.setAttribute("inert", "")
    const slide = document.createElement("div")
    slide.setAttribute("data-slide-paint", "")
    stage.append(slide)
    host.append(stage)
    expect(keydown(window, "r", { code: "KeyR", ctrlKey: true }).defaultPrevented).toBe(false)
    stage.remove()
    expect(renames).toBe(0)
  })
})

describe("LayersPanel shortcuts", () => {
  const frameId = elementId("256.6")
  const childId = elementId("256.4")
  const topId = elementId("256.5")
  const tree: readonly Layer[] = [
    { node: topId, kind: "shape", name: "Ellipse", parent: null, hidden: false, locked: false, layers: [] },
    {
      node: frameId,
      kind: "frame",
      name: "Frame 6",
      parent: null,
      hidden: false,
      locked: false,
      layers: [
        { node: childId, kind: "shape", name: "Rectangle", parent: frameId, hidden: false, locked: false, layers: [] },
      ],
    },
  ]

  it("unfolds the panel and parent groups to start inline rename when requested", async () => {
    const renamed: (readonly [ElementId, string])[] = []
    let handled = 0
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    const render = async (rename: RenameRequest | null) => {
      await act(async () => {
        root.render(
          createElement(LayersPanel, {
            layers: {
              tree,
              selected: [childId],
              rename,
              onRenameStarted: () => {
                handled += 1
              },
              onRename: (node, name) => renamed.push([node, name]),
            },
          }),
        )
      })
    }
    await render(null)
    const fold = host.querySelector<HTMLButtonElement>("[data-layers-fold]")
    await act(async () => {
      fold?.click()
    })
    expect(host.querySelector("[data-layer-list]")).toBeNull()
    await render({ node: childId, at: 1 })
    const field = host.querySelector<HTMLInputElement>("[data-layer-name-field]")
    expect(field).not.toBeNull()
    expect(field?.value).toBe("Rectangle")
    expect(document.activeElement).toBe(field)
    expect(handled).toBe(1)
    await act(async () => {
      if (field !== null) keydown(field, "Escape")
    })
    expect(host.querySelector("[data-layer-name-field]")).toBeNull()
    expect(renamed).toEqual([])
    await render(null)
    await render({ node: childId, at: 2 })
    expect(host.querySelector<HTMLInputElement>("[data-layer-name-field]")?.value).toBe("Rectangle")
    expect(handled).toBe(2)
  })

  it("handles stack and plain-frame shortcuts when a layer row is focused", async () => {
    const stacked: (readonly [ElementId, StackMove])[] = []
    const framed: (readonly ElementId[])[] = []
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(
        createElement(LayersPanel, {
          layers: {
            tree,
            selected: [topId],
            onStack: (node, move) => stacked.push([node, move]),
            onFrame: (nodes) => framed.push(nodes),
          },
        }),
      )
    })
    const row = host.querySelector<HTMLElement>(`[data-layer-row="${topId}"]`)
    if (row === null) throw new Error("no row")
    await act(async () => {
      row.focus()
      keydown(row, "]", { code: "BracketRight" })
      keydown(row, "[", { code: "BracketLeft" })
      keydown(row, "]", { code: "BracketRight", ctrlKey: true })
      keydown(row, "[", { code: "BracketLeft", ctrlKey: true })
      keydown(row, "’", { code: "BracketRight", metaKey: true, altKey: true })
      keydown(row, "“", { code: "BracketLeft", metaKey: true, altKey: true })
      keydown(row, "g", { code: "KeyG", ctrlKey: true, altKey: true })
    })
    expect(stacked).toEqual([
      [topId, "front"],
      [topId, "back"],
      [topId, "forward"],
      [topId, "backward"],
      [topId, "front"],
      [topId, "back"],
    ])
    expect(framed).toEqual([[topId]])
  })

  it("duplicates the selection with Ctrl or Cmd+D on a focused row instead of letting the browser bookmark it", async () => {
    const copied: (readonly ElementId[])[] = []
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(
        createElement(LayersPanel, {
          layers: { tree, selected: [topId, frameId], onDuplicate: (nodes) => copied.push(nodes) },
        }),
      )
    })
    const row = host.querySelector<HTMLElement>(`[data-layer-row="${topId}"]`)
    if (row === null) throw new Error("no row")
    const events: KeyboardEvent[] = []
    await act(async () => {
      row.focus()
      events.push(keydown(row, "d", { code: "KeyD", ctrlKey: true }))
      events.push(keydown(row, "d", { code: "KeyD", metaKey: true }))
    })
    expect(events.map((event) => event.defaultPrevented)).toEqual([true, true])
    expect(copied).toEqual([
      [topId, frameId],
      [topId, frameId],
    ])
  })
})
