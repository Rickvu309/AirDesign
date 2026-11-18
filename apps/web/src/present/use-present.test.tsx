import { act, createElement, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { usePresent, type Present, type PresentDeck } from "./use-present"
import type { ShownSlide } from "./slide-shows"

type JsdomModule = {
  JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
}

let jsdom: JsdomModule | undefined
const held: { current: Present | null } = { current: null }
const teardowns: (() => Promise<void> | void)[] = []

beforeAll(async () => {
  const name = "jsdom"
  jsdom = (await import(name)) as JsdomModule
})

afterEach(async () => {
  held.current = null
  for (const teardown of teardowns.splice(0).reverse()) await teardown()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function openPage(): Root {
  if (jsdom === undefined) throw new Error("jsdom")
  const { window } = new jsdom.JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  })
  vi.useFakeTimers()
  for (const [name, value] of [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ] as const)
    vi.stubGlobal(name, value)
  const container = window.document.getElementById("root")
  if (container === null) throw new Error("root")
  const root = createRoot(container)
  teardowns.push(async () => {
    await act(async () => root.unmount())
    window.close()
  })
  return root
}

function Host({ deck }: { deck: PresentDeck }) {
  const present = usePresent(deck)
  useEffect(() => {
    held.current = present
  })
  return null
}

function deckOf(shows: readonly ShownSlide[]): PresentDeck {
  return { count: shows.length, current: 0, shows: () => shows, onLand: () => undefined }
}

const still = (advance: number | null): ShownSlide => ({ hidden: false, transition: null, advance })

async function start(root: Root, deck: PresentDeck): Promise<void> {
  await act(async () => {
    root.render(createElement(Host, { deck }))
  })
  await act(async () => {
    held.current?.start(0)
  })
}

it("advances after the slide's delay and skips a hidden slide", async () => {
  const root = openPage()
  await start(root, deckOf([still(400), { hidden: true, transition: null, advance: 9000 }, still(null)]))
  expect(held.current?.show?.at).toBe(0)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
  expect(held.current?.show?.at).toBe(2)
})

it("leaves the show when the last slide's delay ends", async () => {
  const root = openPage()
  await start(root, deckOf([still(500)]))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500)
  })
  expect(held.current?.show).toBeNull()
})

it("still advances on click while a delay is waiting", async () => {
  const root = openPage()
  await start(root, deckOf([still(5000), still(null)]))
  await act(async () => {
    held.current?.step("next")
  })
  expect(held.current?.show?.at).toBe(1)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })
  expect(held.current?.show?.at).toBe(1)
})
