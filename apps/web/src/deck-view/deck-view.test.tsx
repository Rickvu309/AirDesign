import { doomRoutes } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import type { DoomRemote } from "@airdesign/live"
import { act } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

const appOrigin = "https://studio.example"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let DeckView: typeof import("./deck-view").DeckView
let deckViewCopy: typeof import("@/copy/deck-view-copy").deckViewCopy
let productCopy: typeof import("@/copy/product-copy").productCopy

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = (await import(module)) as {
    JSDOM: new (
      html: string,
      options: { url: string; pretendToBeVisual: boolean },
    ) => { window: Window & typeof globalThis }
  }
  window = new JSDOM(`<!doctype html><html data-mcp-app data-origin="${appOrigin}"><body></body></html>`, {
    url: "https://sandbox.example/view",
    pretendToBeVisual: true,
  }).window
  for (const name of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "Element",
    "Node",
    "MutationObserver",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ])
    vi.stubGlobal(name, name === "window" ? window : Reflect.get(window, name))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  createRoot = (await import("react-dom/client")).createRoot
  DeckView = (await import("./deck-view")).DeckView
  deckViewCopy = (await import("@/copy/deck-view-copy")).deckViewCopy
  productCopy = (await import("@/copy/product-copy")).productCopy
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const foldWire = (fold: doom.Doom): unknown =>
  JSON.parse(
    JSON.stringify({
      rev: fold.rev,
      nodes: Object.fromEntries(fold.nodes),
      revs: Object.fromEntries([...fold.revs].map(([node, revs]) => [node, doom.revsToJson(revs)])),
      onces: Object.fromEntries(fold.onces),
      runs: doom.runsToJson(fold.runs),
    }),
  )

function remoteOf(opened: unknown): DoomRemote {
  const refused = { ok: false, refusal: "session" } as const
  return {
    create: async () => refused,
    edit: async () => refused,
    open: async () => doomRoutes.open.result(opened),
    since: (_body, signal) =>
      new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError"))),
      ),
    screenshots: async () => refused,
  }
}

async function linkIn(remote: DoomRemote, name: string): Promise<string | null> {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<DeckView id="d1" remote={remote} shell={{ openLink: () => undefined }} />))
    await vi.waitFor(() => {
      if (!host.textContent?.includes(name)) throw new Error(`No ${name} link yet`)
    })
    const link = [...host.querySelectorAll("a")].find((each) => each.textContent === name)
    return link?.getAttribute("href") ?? null
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}

it("opens the deck in AirDesign at the app's origin, not the chat's", async () => {
  const fold = doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
  const remote = remoteOf({ ok: true, deck: "d1", rev: fold.rev, fold: foldWire(fold) })
  expect(await linkIn(remote, deckViewCopy.openInAirDesign)).toBe(`${appOrigin}/s/d1`)
})

it("sends a person to their decks at the app's origin when the deck is not found", async () => {
  const remote = remoteOf({ ok: false, refusal: "deck" })
  expect(await linkIn(remote, productCopy.goToDecks)).toBe(`${appOrigin}/`)
})
