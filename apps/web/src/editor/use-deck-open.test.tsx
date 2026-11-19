import { openRegister, slideId, type Register } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { useDeckOpen, type OpeningDeck } from "./use-deck-open"
import type { DeckPaint } from "./use-deck-paint"

const world = vi.hoisted(() => ({
  order: [] as string[],
  local: null as Register | null,
  remote: null as Register | null,
  opened: [] as (Register | null)[],
  releaseServer: (): void => undefined,
}))

vi.mock("@/device-copy", () => ({
  deviceCopy: async () => {
    world.order.push("device")
    return { stored: { parts: new Map(), name: "Clean" }, register: world.local }
  },
  deckParts: async () => ({ parts: new Map(), name: "Clean" }),
  closesDeck: () => false,
}))

vi.mock("@/index-deck", () => ({
  backfillIndex: () => {
    world.order.push("index")
    return new Promise(() => undefined)
  },
}))

vi.mock("@/deck-follow", () => ({
  followDeck: () => {
    world.order.push("follow")
    return new Promise(() => undefined)
  },
}))

vi.mock("@airdesign/live", () => ({
  connect: () => ({
    open: async () => ({ ok: true }),
    openDeck: async () => {
      await new Promise<void>((resolve) => {
        world.releaseServer = () => resolve()
      })
      world.order.push("server")
      return world.remote === null ? { ok: false, refusal: "deck" as const } : { ok: true, register: world.remote }
    },
    flush: () => {
      world.order.push("flush")
      return new Promise(() => undefined)
    },
    pending: async () => [],
  }),
  httpRemote: () => ({}),
  flushOriginal: () => {
    world.order.push("upload")
    return Promise.resolve({ ok: true })
  },
  memoryRemote: () => ({}),
}))

let window: Window & typeof globalThis
let root: Root | null = null

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  vi.stubGlobal("window", window)
  vi.stubGlobal("document", window.document)
  vi.stubGlobal("HTMLElement", window.HTMLElement)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
})

afterEach(async () => {
  await act(async () => {
    root?.unmount()
  })
  root = null
  world.order.length = 0
  world.opened.length = 0
  world.local = null
  world.remote = null
  world.releaseServer = (): void => undefined
})

function opening(): OpeningDeck {
  const shown = {
    store: { current: { slides: () => [] } },
    shownParts: { current: new Map() },
    pictures: { current: null },
    structure: { current: "" },
    bound: { current: new Set() },
    repaint: { current: () => undefined },
    setCurrent: () => undefined,
    showOpened: (_parts: unknown, register: Register | null) => {
      world.order.push("shown")
      world.opened.push(register)
    },
    showRegister: () => undefined,
    shownRegister: { current: null },
  }
  return {
    id: "deck",
    shown: shown as unknown as DeckPaint,
    notesBar: { show: () => undefined },
    settle: () => {
      world.order.push("settle")
    },
    setTitle: () => undefined,
    setPaintedDeck: () => undefined,
    setRefused: () => undefined,
    setFailure: () => undefined,
    aside: 0,
  }
}

it("follows a deck from the moment it is shown, while the index is still open", async () => {
  const deck = opening()
  function Open() {
    useDeckOpen(deck)
    return null
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root?.render(createElement(Open))
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
  await act(async () => {
    world.releaseServer()
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
  expect(world.order).toContain("follow")
  expect(world.order.indexOf("shown")).toBeLessThan(world.order.indexOf("follow"))
  expect(world.order.indexOf("follow")).toBeLessThan(world.order.indexOf("index"))
  expect(world.order).not.toContain("flush")
  expect(world.order).not.toContain("upload")
})

const file = openRegister("", "deck")
const edited: Register = { ...file, order: [{ slide: "remove", id: slideId("256") }] }

it("paints the server register when the device copy has no edits", async () => {
  world.local = file
  world.remote = edited
  const deck = opening()
  function Open() {
    useDeckOpen(deck)
    return null
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root?.render(createElement(Open))
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
  await act(async () => {
    world.releaseServer()
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
  expect(world.opened).toEqual([edited])
  expect(world.order.indexOf("shown")).toBeGreaterThan(world.order.indexOf("server"))
  expect(world.order.indexOf("follow")).toBeGreaterThan(world.order.indexOf("shown"))
  expect(world.order.indexOf("follow")).toBeLessThan(world.order.indexOf("index"))
})

it("shows a local edit before the server answers", async () => {
  world.local = edited
  world.remote = file
  const deck = opening()
  function Open() {
    useDeckOpen(deck)
    return null
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root?.render(createElement(Open))
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
  expect(world.opened).toEqual([edited])
  expect(world.order).not.toContain("server")
  world.releaseServer()
})
