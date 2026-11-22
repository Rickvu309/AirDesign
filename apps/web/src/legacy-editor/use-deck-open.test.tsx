import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { useDeckOpen, type OpeningDeck } from "./use-deck-open"
import type { DeckPaint } from "../editor/use-deck-paint"

const world = vi.hoisted(() => ({ order: [] as string[], held: true }))

vi.mock("@/device-copy", () => ({
  deviceCopy: async () => {
    world.order.push("device")
    return { stored: { parts: new Map(), name: "Clean" }, register: null }
  },
  deckParts: async () => ({ parts: new Map(), name: "Clean" }),
  closesDeck: () => false,
}))

vi.mock("@/index-deck", () => ({
  backfillIndex: () => {
    world.order.push("index")
    return world.held ? new Promise(() => undefined) : Promise.resolve()
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
    openDeck: async () => ({ ok: false, refusal: "deck" }),
    flush: () => {
      world.order.push("flush")
      return world.held ? new Promise(() => undefined) : Promise.resolve({ ok: true })
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
  world.held = true
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
    showOpened: () => {
      world.order.push("shown")
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
    setOpenedDeck: (deck) => {
      if (deck !== undefined) world.order.push(`opened ${deck}`)
    },
    setRefused: () => undefined,
    setFailure: () => undefined,
    aside: 0,
  }
}

async function openDeck(): Promise<void> {
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
}

it("follows a deck from the moment it is shown, while the index is still open", async () => {
  await openDeck()
  expect(world.order).toContain("follow")
  expect(world.order.indexOf("shown")).toBeLessThan(world.order.indexOf("follow"))
  expect(world.order.indexOf("follow")).toBeLessThan(world.order.indexOf("index"))
  expect(world.order).not.toContain("flush")
  expect(world.order).not.toContain("upload")
  expect(world.order).not.toContain("opened deck")
})

it("marks the deck opened once its index is sent and its edits are flushed", async () => {
  world.held = false
  await openDeck()
  expect(world.order.slice(world.order.indexOf("index"))).toEqual(["index", "flush", "settle", "opened deck", "upload"])
})
