import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { Home } from "@/decks/home"
import { clearFirstRequest, handFirstRequest } from "@/lib/first-request"

const listing = {
  ok: true,
  account: { email: "person@example.com" },
  decks: [],
  trash: [],
}

let host: HTMLDivElement
let root: Root
let close: () => void
const opened: string[] = []

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" })
  close = () => window.close()
  window.matchMedia = () =>
    ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => Response.json(listing)),
  )
})

afterEach(async () => {
  clearFirstRequest()
  if (root) await act(async () => root.unmount())
  host?.remove()
  opened.length = 0
})

afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

function named(name: string): HTMLButtonElement[] {
  return [...host.querySelectorAll("button")].filter((button) => button.textContent?.trim() === name)
}

async function show(section: "recents" | "all-decks" | "trash" = "recents") {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Home section={section} navigate={(path) => opened.push(path)} />))
}

it("starts an empty home from one New deck button", async () => {
  await show()
  expect(host.textContent).toContain(productCopy.noDecksTitle)
  expect(named(productCopy.newDeck)).toHaveLength(1)
  expect(named(productCopy.blankDeck)).toHaveLength(0)
  await act(async () => named(productCopy.newDeck)[0]?.click())
  expect(opened).toEqual(["/s"])
})

it("starts All decks the same way when none are listed", async () => {
  await show("all-decks")
  expect(named(productCopy.newDeck)).toHaveLength(1)
  expect(named(productCopy.blankDeck)).toHaveLength(0)
})

it("offers no deck start on Trash", async () => {
  await show("trash")
  expect(named(productCopy.newDeck)).toHaveLength(0)
  expect(named(productCopy.blankDeck)).toHaveLength(0)
})

const box = () => host.querySelector(`textarea[aria-label="${productCopy.describeDeck}"]`)

it("offers the words again when the editor was left before it opened", async () => {
  handFirstRequest("A board update on Q3 revenue, numbers first")
  await show()
  expect((box() as HTMLTextAreaElement).value).toBe("A board update on Q3 revenue, numbers first")
})

it("offers the Describe your deck box on Recents, and on neither All decks nor Trash", async () => {
  await show()
  expect(box()).not.toBeNull()
  await act(async () => root.unmount())
  host.remove()
  await show("all-decks")
  expect(box()).toBeNull()
  await act(async () => root.unmount())
  host.remove()
  await show("trash")
  expect(box()).toBeNull()
})
