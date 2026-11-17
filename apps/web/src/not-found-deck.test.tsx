import { ResizeObserverFixture, type JsdomModule } from "./deck-dom-fixtures"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "./copy/product-copy"
import { ThinDeck } from "./thin-deck"

const live = vi.hoisted(() => ({ refusal: "owner" as string }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  queueOriginal: vi.fn(),
  flushOriginal: vi.fn(),
  getParts: async () => ({ ok: false, refusal: "absent" }),
  putParts: async () => ({ ok: false }),
  fetchOriginal: async () => ({ ok: false, refusal: live.refusal }),
  connect: () => ({
    index: async () => ({ ok: true }),
    flush: async () => ({ ok: true }),
    openDeck: async () => ({ ok: false, refusal: "deck" }),
    open: async () => ({ ok: true }),
  }),
}))

let jsdom: JsdomModule | undefined

beforeAll(async () => {
  const jsdomName = "jsdom"
  jsdom = (await import(jsdomName)) as JsdomModule
})

const teardowns: (() => Promise<void> | void)[] = []

afterEach(async () => {
  for (const teardown of teardowns.splice(0).reverse()) await teardown()
  vi.unstubAllGlobals()
})

async function openedDeck(refusal: string) {
  vi.stubGlobal("ResizeObserver", ResizeObserverFixture)
  live.refusal = refusal
  if (jsdom === undefined) throw new Error("jsdom")
  const { window } = new jsdom.JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  })
  const globals = globalThis as typeof globalThis & Record<string, unknown>
  const defined: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  window.matchMedia = () =>
    ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  const previous = defined.map(([name]) => [name, globals[name]] as const)
  for (const [name, value] of defined)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  teardowns.push(() => {
    for (const [name, value] of previous)
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    window.close()
  })
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }))
  const container = window.document.getElementById("root")
  if (container === null) throw new Error("root")
  const root = createRoot(container)
  teardowns.push(async () => {
    await act(async () => {
      root.unmount()
    })
  })
  await act(async () => {
    root.render(<ThinDeck id="gone-deck" />)
  })
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
  return window
}

it.each(["owner", "deleted", "missing"])(
  "shows a not-found page with a link to the decks and no editor when the server answers %s",
  async (refusal) => {
    const window = await openedDeck(refusal)
    const page = window.document.querySelector("[data-deck-refused]")
    expect(page?.textContent).toContain(productCopy.deckNotFoundTitle)
    expect(page?.textContent).toContain(productCopy.deckNotFoundBody)
    const link = [...window.document.querySelectorAll("a")].find((each) => each.textContent === productCopy.goToDecks)
    expect(link?.getAttribute("href")).toBe("/")
    expect(window.document.querySelector('[contenteditable="true"]')).toBeNull()
    expect(window.document.querySelector("[data-slide-paint]")).toBeNull()
    expect(window.document.body.textContent).not.toContain("Export")
    expect(window.document.body.textContent).not.toContain("New slide")
    expect(window.document.body.textContent).not.toContain(productCopy.deckOpenFailed)
  },
)

it.each(["storage", "server"])(
  "keeps the import notice over the editor when the server answers %s",
  async (refusal) => {
    const window = await openedDeck(refusal)
    expect(window.document.body.textContent).toContain(productCopy.deckOpenFailed)
    expect(window.document.body.textContent).not.toContain(productCopy.deckNotFoundTitle)
  },
)
