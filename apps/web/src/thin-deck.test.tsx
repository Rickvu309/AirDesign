import { elementId, writeTextValue, type Register } from "@airdesign/document"
import type { Remote } from "@airdesign/live"
import { readPackage } from "@airdesign/pptx"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "./copy/product-copy"
import { signInAddress } from "./thin-notice"
import { editedRegister, fallbackSlide, xml } from "./slide-fixtures"
import { commitEdit } from "./commit-edit"
import { saveDeck } from "./import-deck"
import { elementIds, ThinDeck } from "./thin-deck"

const live = vi.hoisted(() => {
  const sent: { deck: string; value: string; node: string; floor: string }[] = []
  const saved: { deck: string; parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array; name?: string }[] = []
  const reads: string[] = []
  const flushed: string[] = []
  const state: {
    parts: { ok: true; parts: ReadonlyMap<string, Uint8Array>; name?: string } | { ok: false; refusal: "absent" }
    opened: { ok: true; register: unknown } | { ok: false; refusal: "deck" }
    refuse: boolean
    original: { ok: true; file: Uint8Array } | { ok: false; refusal: "storage" }
  } = {
    parts: { ok: false, refusal: "absent" },
    opened: { ok: false, refusal: "deck" },
    refuse: false,
    original: { ok: false, refusal: "storage" },
  }
  const counts = { openDeck: 0, flush: 0, fetchOriginal: 0 }
  type Counted = keyof typeof counts
  let waiters: { kind: Counted; count: number; resolve: () => void }[] = []
  function happened(kind: Counted) {
    counts[kind] += 1
    for (const waiter of waiters) if (waiter.kind === kind && counts[kind] >= waiter.count) waiter.resolve()
    waiters = waiters.filter((waiter) => waiter.kind !== kind || counts[kind] < waiter.count)
  }
  return {
    sent,
    saved,
    reads,
    flushed,
    state,
    reset() {
      Object.assign(counts, { fetchOriginal: 0, openDeck: 0, flush: 0 })
      state.original = { ok: false, refusal: "storage" }
      for (const list of [sent, reads, saved, flushed]) list.length = 0
      waiters = []
      state.parts = { ok: false, refusal: "absent" }
      state.opened = { ok: false, refusal: "deck" }
      state.refuse = false
    },
    reached(kind: Counted, count: number): Promise<void> {
      if (counts[kind] >= count) return Promise.resolve()
      return new Promise((resolve) => waiters.push({ kind, count, resolve }))
    },
    getParts: async (deck: string) => {
      reads.push(deck)
      return state.parts
    },
    putParts: async (
      deck: string,
      stored: { parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array; name?: string },
    ) => {
      saved.push({ deck, ...stored })
      return { ok: true, ...stored }
    },
    fetchOriginal: async (deck: string) => {
      reads.push(deck)
      happened("fetchOriginal")
      return state.original
    },
    connect: () => ({
      index: async () => ({ ok: true }),
      async enqueue(deck: string, value: string, node: string, floor: string) {
        if (state.refuse) return { ok: false, refusal: "limit" }
        sent.push({ deck, value, node, floor })
        return { ok: true, painted: value }
      },
      async flush(deck: string) {
        flushed.push(deck)
        happened("flush")
        return { ok: true }
      },
      async openDeck() {
        happened("openDeck")
        return state.opened
      },
      open: async () => ({ ok: true }),
    }),
  }
})

vi.mock("@airdesign/live", async () => {
  return {
    ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
    queueOriginal: vi.fn(),
    flushOriginal: vi.fn(),
    connect: live.connect,
    getParts: live.getParts,
    putParts: live.putParts,
    fetchOriginal: live.fetchOriginal,
  }
})

async function cleanParts(): Promise<ReadonlyMap<string, Uint8Array>> {
  const read = await readPackage(await cleanFile())
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

async function cleanFile(): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url))
}

const editedId = (async () => {
  const id = elementIds(await cleanParts())[0]
  if (id === undefined) throw new Error("missing")
  return id
})()

type JsdomModule = {
  JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
}

let jsdom: JsdomModule | undefined

beforeAll(async () => {
  const jsdomName = "jsdom"
  jsdom = (await import(jsdomName)) as JsdomModule
  await editedId
})

const teardowns: (() => Promise<void> | void)[] = []

afterEach(async () => {
  for (const teardown of teardowns.splice(0).reverse()) await teardown()
  vi.unstubAllGlobals()
})

async function postsCommit(remote: Remote, deck: string, node: string): Promise<boolean> {
  const seen: string[] = []
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    seen.push(String(url))
    expect(String(init.method)).toBe("POST")
    expect(String(init.credentials)).toBe("same-origin")
    expect(JSON.parse(String(init.body))).toEqual({ deck, batch: [{ value: "Hello!", node }] })
    return new Response(JSON.stringify({ ok: true, deck, revision: 1, key: `${deck}:1` }))
  })
  await remote.commit({ deck, batch: [{ value: "Hello!", node: elementId(node) }] })
  return seen[0] === "/decks/commit"
}

it("flushes the http remote for the given deck after Hello! on its element", async () => {
  const node = await editedId
  const calls: {
    op: "enqueue" | "flush"
    remote: Remote
    deck: string
    value?: string
    node?: string
    floor?: string
  }[] = []
  await commitEdit(
    (remote) => {
      return {
        async enqueue(deck, value, named, floor) {
          calls.push({ op: "enqueue", remote, deck, value, node: named, floor })
          return { ok: true }
        },
        async flush(deck) {
          calls.push({ op: "flush", remote, deck })
          return { ok: true }
        },
        async pending() {
          return []
        },
      }
    },
    "different-deck",
    "Hello!",
    { id: node, file: "Hello" },
  )
  const enqueued = calls[0]
  const flushed = calls[1]
  expect(calls.map((call) => call.op)).toEqual(["enqueue", "flush"])
  expect(enqueued).toMatchObject({ deck: "different-deck", value: "Hello!", node, floor: "Hello" })
  expect(flushed).toMatchObject({ deck: "different-deck" })
  if (enqueued === undefined || flushed === undefined) return
  expect(await postsCommit(enqueued.remote, "different-deck", node)).toBe(false)
  expect(await postsCommit(flushed.remote, "different-deck", node)).toBe(true)
})

function oneRun(text: string): string {
  return writeTextValue([{ from: 0, runs: [{ from: 0, text }] }])
}

function shapedParts(): Map<string, Uint8Array> {
  const slide2 = `<p:sld><p:sp><p:cNvPr id="2"/><p:txBody><a:p><a:r><a:t>Other</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`
  const slide1 = `<p:sld><p:sp><p:cNvPr id="5"/><p:txBody><a:p><a:r><a:t>First</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:cNvPr id="2"/><p:txBody><a:p><a:r><a:t>Keep</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:cNvPr id="9"/><p:txBody><a:p><a:r><a:t>Last</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`
  const presentation = `<p:presentation><p:sldIdLst><p:sldId id="452" r:id="rId3"/><p:sldId id="382" r:id="rId2"/></p:sldIdLst></p:presentation>`
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
  return new Map([
    ["ppt/slides/slide2.xml", xml(slide2)],
    ["ppt/slides/slide1.xml", xml(slide1)],
    ["ppt/presentation.xml", xml(presentation)],
    ["ppt/_rels/presentation.xml.rels", xml(rels)],
  ])
}

async function renderedDeck(
  parts: ReadonlyMap<string, Uint8Array> | Uint8Array | null,
  deck = "opened-deck",
  register: Register | null = null,
  name?: string,
) {
  live.reset()
  if (parts instanceof Uint8Array) live.state.original = { ok: true, file: parts }
  else if (parts !== null) live.state.parts = { ok: true, parts, ...(name === undefined ? {} : { name }) }
  if (register !== null) live.state.opened = { ok: true, register }
  if (jsdom === undefined) throw new Error("jsdom")
  const dom = new jsdom.JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  })
  const { window } = dom
  const globals = globalThis as typeof globalThis & Record<string, unknown>
  const defined: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["InputEvent", window.InputEvent],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  window.matchMedia = () =>
    ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  const previous = defined.map(([name]) => [name, globals[name]] as const)
  for (const [name, value] of defined) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  teardowns.push(() => {
    for (const [name, value] of previous) {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    }
    window.close()
  })
  const container = window.document.getElementById("root")
  if (container === null) throw new Error("root")
  const root = createRoot(container)
  teardowns.push(async () => {
    await act(async () => {
      root.unmount()
    })
  })
  const sentOnOpen = parts === null ? live.reached("fetchOriginal", 1) : live.reached("flush", 1)
  await act(async () => {
    root.render(<ThinDeck id={deck} />)
  })
  await act(async () => {
    await sentOnOpen
  })
  return window
}

async function showSlide(window: Window & typeof globalThis, number: number): Promise<void> {
  const entry = window.document.querySelector(`[data-slide-entry="${number}"]`)
  if (entry === null) throw new Error(`slide ${number}`)
  await act(async () => {
    entry.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
  })
}

function boxShowing(window: Window & typeof globalThis, text: string): Element {
  const found = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === text)
  if (found === undefined) throw new Error(text)
  return found
}

async function typeInto(
  window: Window & typeof globalThis,
  box: Element,
  value: string,
  flushes: number,
): Promise<void> {
  const typed = window.document.createTreeWalker(box, window.NodeFilter.SHOW_TEXT).nextNode()
  if (typed === null) box.textContent = value
  else typed.nodeValue = value
  const flushed = live.reached("flush", flushes)
  await act(async () => {
    box.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
    await flushed
  })
}

async function committedNodes(
  parts: ReadonlyMap<string, Uint8Array>,
  from: string,
  values: readonly string[],
  deck = "opened-deck",
  slide = 1,
): Promise<readonly (string | undefined)[]> {
  const window = await renderedDeck(parts, deck)
  await showSlide(window, slide)
  const passage = boxShowing(window, from)
  for (const [index, value] of values.entries()) await typeInto(window, passage, value, index + 2)
  return live.sent.map((edit) => edit.node)
}

it("saves the thin edit under its element id", async () => {
  expect(await committedNodes(await cleanParts(), "Hello", ["Hello!"])).toEqual(["256.2"])
})

it("saves every edit under the id of the shape that was edited", async () => {
  expect(await committedNodes(shapedParts(), "Keep", ["Next", "Later"], "opened-deck", 2)).toEqual(["382.2", "382.2"])
})

it("saves every edit under the deck id in the address", async () => {
  await committedNodes(shapedParts(), "Keep", ["Next", "Later"], "address-deck", 2)
  expect(live.sent.map((edit) => edit.deck)).toEqual(["address-deck", "address-deck"])
  expect(live.reads).toContain("address-deck")
})

it("saves files with distinct valid deck ids", async () => {
  live.reset()
  const firstParts = new Map([["first", new Uint8Array([1])]])
  const secondParts = new Map([["second", new Uint8Array([2])]])
  const first = await saveDeck(firstParts, new Uint8Array([1]))
  const second = await saveDeck(secondParts, new Uint8Array([2]))
  expect(first).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  expect(second).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  expect(first).not.toBe(second)
  expect(live.saved).toEqual([
    { deck: first, parts: firstParts, file: new Uint8Array([1]) },
    { deck: second, parts: secondParts, file: new Uint8Array([2]) },
  ])
})

async function editableTexts(window: Window & typeof globalThis, slide: number): Promise<readonly string[]> {
  await showSlide(window, slide)
  return [...window.document.querySelectorAll('[contenteditable="true"]')].map((node) => node.textContent ?? "").sort()
}

it("does not offer a locked box for editing", async () => {
  const parts = shapedParts()
  parts.set("ppt/slides/slide1.xml", xml(fallbackSlide))
  const window = await renderedDeck(parts)
  await showSlide(window, 2)
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(await editableTexts(window, 2)).toEqual(["Choice"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

async function offeredWith(body: string) {
  const parts = shapedParts()
  const slide = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  const keep = "<p:txBody><a:p><a:r><a:t>Keep</a:t></a:r></a:p></p:txBody>"
  expect(slide).toContain(keep)
  parts.set("ppt/slides/slide1.xml", xml(slide.replace(keep, `<p:txBody>${body}</p:txBody>`)))
  const window = await renderedDeck(parts)
  await showSlide(window, 2)
  return window
}

it("offers a box with two runs in one paragraph for editing and shows each run", async () => {
  const window = await offeredWith("<a:p><a:r><a:t>Ke</a:t></a:r><a:r><a:t>ep</a:t></a:r></a:p>")
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("true")
  expect([...(shown?.querySelectorAll("[data-run]") ?? [])].map((run) => run.textContent)).toEqual(["Ke", "ep"])
  expect(await editableTexts(window, 2)).toEqual(["First", "Keep", "Last"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

it("offers a box with several paragraphs for editing and shows each paragraph", async () => {
  const window = await offeredWith("<a:p><a:r><a:t>Ke</a:t></a:r></a:p><a:p><a:r><a:t>ep</a:t></a:r></a:p>")
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("true")
  expect([...(shown?.querySelectorAll("[data-paragraph]") ?? [])].map((run) => run.textContent)).toEqual(["Ke", "ep"])
  expect(await editableTexts(window, 2)).toEqual(["First", "Keep", "Last"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

it("offers an empty box for editing", async () => {
  const window = await offeredWith('<a:p><a:endParaRPr lang="en-US"/></a:p>')
  expect(await editableTexts(window, 2)).toEqual(["", "First", "Last"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

it("does not offer a slide-number box for editing", async () => {
  const window = await offeredWith(`<a:p><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>Keep</a:t></a:fld></a:p>`)
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(await editableTexts(window, 2)).toEqual(["First", "Last"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

it("names every element by its slide id and shape id in the server's pattern", () => {
  const ids = elementIds(shapedParts())
  expect(ids).toEqual(["452.2", "382.5", "382.2", "382.9"])
  for (const id of ids) expect(id).toMatch(/^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/)
})

it("commits each box under its own id with its file text as floor", async () => {
  const window = await renderedDeck(shapedParts())
  await showSlide(window, 2)
  await typeInto(window, boxShowing(window, "First"), "One", 2)
  await typeInto(window, boxShowing(window, "Last"), "Two", 3)
  await showSlide(window, 1)
  await typeInto(window, boxShowing(window, "Other"), "Three", 4)
  await showSlide(window, 2)
  await typeInto(window, boxShowing(window, "One"), "Four", 5)
  expect(live.sent).toEqual([
    { deck: "opened-deck", value: oneRun("One"), node: "382.5", floor: oneRun("First") },
    { deck: "opened-deck", value: oneRun("Two"), node: "382.9", floor: oneRun("Last") },
    { deck: "opened-deck", value: oneRun("Three"), node: "452.2", floor: oneRun("Other") },
    { deck: "opened-deck", value: oneRun("Four"), node: "382.5", floor: oneRun("First") },
  ])
})

it("paints each element's stored value after a reload and the file text elsewhere", async () => {
  const window = await renderedDeck(
    shapedParts(),
    "opened-deck",
    editedRegister([
      ["382.9", "Stored last"],
      ["452.2", "Stored other"],
    ]),
  )
  expect(await editableTexts(window, 2)).toEqual(["First", "Keep", "Stored last"])
  expect(await editableTexts(window, 1)).toEqual(["Stored other"])
})

it("rebuilds a deck this device lost from the server's original and paints the saved edits", async () => {
  const file = await cleanFile()
  const window = await renderedDeck(file, "cleared-deck", editedRegister([[await editedId, "Kept on the server"]]))
  expect(window.document.querySelector('[contenteditable="true"]')?.textContent).toBe("Kept on the server")
  expect(window.document.querySelector("[data-deck-ready]")?.getAttribute("data-deck-ready")).toBe("cleared-deck")
  expect(live.saved.map((each) => [each.deck, each.file])).toEqual([["cleared-deck", file]])
})

it("shows the import notice and no slide when neither the device nor the server has the original", async () => {
  const window = await renderedDeck(null, "lost-deck")
  await act(async () => {})
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
  expect(window.document.querySelector("[data-slide-paint]")).toBeNull()
  expect(window.document.body.textContent).toContain(productCopy.deckOpenFailed)
})

it("sends what is pending when a deck opens", async () => {
  await renderedDeck(shapedParts(), "address-deck")
  expect(live.flushed).toEqual(["address-deck"])
})

it("puts a refused edit back to the last stored text", async () => {
  const window = await renderedDeck(shapedParts(), "opened-deck", editedRegister([["382.9", "Stored last"]]))
  live.state.refuse = true
  await showSlide(window, 2)
  const last = boxShowing(window, "Stored last")
  const first = boxShowing(window, "First")
  for (const [index, [box, typed]] of (
    [
      [last, "x".repeat(9000)],
      [first, "y".repeat(9000)],
    ] as const
  ).entries()) {
    box.textContent = typed
    const reopened = live.reached("openDeck", index + 2)
    await act(async () => {
      box.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
      await reopened
    })
    await act(async () => {})
  }
  expect(last.textContent).toBe("Stored last")
  expect(first.textContent).toBe("First")
  expect(live.sent).toEqual([])
})

it("does not offer a locked box whose fallback twin has one run", async () => {
  const parts = shapedParts()
  const one = fallbackSlide.replace(
    /<a:p><a:r><a:t>One<\/a:t>.*?<a:t>Three<\/a:t><\/a:r><\/a:p>/,
    "<a:p><a:r><a:t>Old</a:t></a:r></a:p>",
  )
  expect(one).not.toBe(fallbackSlide)
  parts.set("ppt/slides/slide1.xml", xml(one))
  const window = await renderedDeck(parts)
  await showSlide(window, 2)
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(await editableTexts(window, 2)).toEqual(["Choice"])
  expect(await editableTexts(window, 1)).toEqual(["Other"])
})

function inPartOrder(): Map<string, Uint8Array> {
  const parts = shapedParts()
  return new Map([...parts].sort(([left], [right]) => left.localeCompare(right)))
}

function slideTexts(window: Window): readonly string[] {
  return [...window.document.querySelectorAll("[contenteditable]")].map((node) => node.textContent ?? "")
}

it("lists the slides in the file's order, not the part-name order", async () => {
  const parts = inPartOrder()
  expect([...parts.keys()].filter((name) => name.startsWith("ppt/slides/"))).toEqual([
    "ppt/slides/slide1.xml",
    "ppt/slides/slide2.xml",
  ])
  const window = await renderedDeck(parts)
  expect([...window.document.querySelectorAll("[data-slide-entry]")].map((entry) => entry.textContent)).toEqual([
    "1",
    "2",
  ])
  expect(slideTexts(window)).toEqual(["Other"])
  await showSlide(window, 2)
  expect(slideTexts(window)).toEqual(["First", "Keep", "Last"])
})

it("shows one slide at a time and keeps an edit when the slide changes and comes back", async () => {
  const window = await renderedDeck(shapedParts())
  expect(slideTexts(window)).toEqual(["Other"])
  await showSlide(window, 2)
  expect(slideTexts(window)).toEqual(["First", "Keep", "Last"])
  await typeInto(window, boxShowing(window, "Keep"), "Kept", 2)
  await showSlide(window, 1)
  expect(slideTexts(window)).toEqual(["Other"])
  await showSlide(window, 2)
  expect(slideTexts(window)).toEqual(["First", "Kept", "Last"])
})

it("names the opened file and shows no sample deck words", async () => {
  const window = await renderedDeck(shapedParts(), "opened-deck", null, "Quarterly review")
  const text = window.document.body.textContent ?? ""
  expect(text).toContain("Quarterly review")
  expect(text).not.toContain("Q3 Investor Update")
  expect(text).toContain("New slide")
  expect(text).not.toContain("Opening")
})

it("shows an empty title for a deck stored without a name", async () => {
  const window = await renderedDeck(shapedParts())
  const text = window.document.body.textContent ?? ""
  expect(text).not.toContain("Q3 Investor Update")
})

it("sends a signed-out person to sign in with the current path and query as next", () => {
  expect(signInAddress({ pathname: "/deck/abc-123", search: "?slide=2" })).toBe(
    "/sign-in?next=%2Fdeck%2Fabc-123%3Fslide%3D2",
  )
})
