import { decide, elementId, openRegister, writeTextValue, type Register } from "@airdesign/document"
import type { Remote } from "@airdesign/live"
import { readPackage } from "@airdesign/pptx"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { commitEdit, elementIds, exportedParts, saveDeck, ThinDeck } from "./thin-deck"

const live = vi.hoisted(() => {
  const sent: { deck: string; value: string; node: string; floor: string }[] = []
  const saved: { deck: string; parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array }[] = []
  const reads: string[] = []
  const flushed: string[] = []
  const state: {
    parts: { ok: true; parts: ReadonlyMap<string, Uint8Array> } | { ok: false; refusal: "absent" }
    opened: { ok: true; register: unknown } | { ok: false; refusal: "deck" }
    refuse: boolean
    gate: Promise<void> | null
  } = { parts: { ok: false, refusal: "absent" }, opened: { ok: false, refusal: "deck" }, refuse: false, gate: null }
  const counts = { openDeck: 0, flush: 0, putParts: 0 }
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
      sent.length = 0
      reads.length = 0
      saved.length = 0
      flushed.length = 0
      counts.openDeck = 0
      counts.flush = 0
      counts.putParts = 0
      waiters = []
      state.parts = { ok: false, refusal: "absent" }
      state.opened = { ok: false, refusal: "deck" }
      state.refuse = false
      state.gate = null
    },
    reached(kind: Counted, count: number): Promise<void> {
      if (counts[kind] >= count) return Promise.resolve()
      return new Promise((resolve) => {
        waiters.push({ kind, count, resolve })
      })
    },
    getParts: async (deck: string) => {
      reads.push(deck)
      if (state.gate !== null) await state.gate
      return state.parts
    },
    putParts: async (deck: string, stored: { parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array }) => {
      saved.push({ deck, ...stored })
      happened("putParts")
      return { ok: true, ...stored }
    },
    connect: () => ({
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
    }),
  }
})

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@airdesign/live")
  return {
    ...actual,
    connect: () => live.connect(),
    getParts: (deck: string) => live.getParts(deck),
    putParts: (deck: string, stored: { parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array }) =>
      live.putParts(deck, stored),
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

function xml(text: string): Uint8Array {
  return new TextEncoder().encode(text)
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

async function wasmBytes(): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const moduleName = "node:module"
  const fs = (await import(fsName)) as { readFile: (path: string) => Promise<Uint8Array> }
  const nodeModule = (await import(moduleName)) as {
    createRequire: (url: string) => { resolve: (id: string) => string }
  }
  return fs.readFile(nodeModule.createRequire(import.meta.url).resolve("sax-wasm/lib/sax-wasm.wasm"))
}

async function renderedDeck(
  parts: ReadonlyMap<string, Uint8Array>,
  deck: string | undefined = "opened-deck",
  register: Register | null = null,
) {
  live.reset()
  live.state.parts = { ok: true, parts }
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
  ]
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
  const wasm = await wasmBytes()
  const copy = new Uint8Array(wasm.byteLength)
  copy.set(wasm)
  vi.stubGlobal("fetch", async () => new Response(copy.buffer))
  const root = createRoot(container)
  teardowns.push(async () => {
    await act(async () => {
      root.unmount()
    })
  })
  if (deck === undefined) {
    await act(async () => {
      root.render(<ThinDeck />)
    })
    return window
  }
  const sentOnOpen = live.reached("flush", 1)
  await act(async () => {
    root.render(<ThinDeck id={deck} />)
  })
  await act(async () => {
    await sentOnOpen
  })
  return window
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
): Promise<readonly (string | undefined)[]> {
  const window = await renderedDeck(parts, deck)
  const passage = boxShowing(window, from)
  for (const [index, value] of values.entries()) await typeInto(window, passage, value, index + 2)
  return live.sent.map((edit) => edit.node)
}

it("saves the thin edit under its element id", async () => {
  expect(await committedNodes(await cleanParts(), "Hello", ["Hello!"])).toEqual(["256.2"])
})

it("saves every edit under the id of the shape that was edited", async () => {
  expect(await committedNodes(shapedParts(), "Keep", ["Next", "Later"])).toEqual(["382.2", "382.2"])
})

it("paints before the commit is sent", async () => {
  const order: string[] = []
  let sentFlush: () => void = () => undefined
  const flushSent = new Promise<void>((resolve) => {
    sentFlush = resolve
  })
  void commitEdit(
    () => {
      return {
        async enqueue() {
          order.push("enqueue")
          return { ok: true }
        },
        flush() {
          order.push("flush")
          sentFlush()
          return new Promise(() => undefined)
        },
      }
    },
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
    () => {
      order.push("paint")
    },
  )
  await flushSent
  expect(order).toEqual(["enqueue", "paint", "flush"])
})

function onSlide(slide: Uint8Array): Map<string, Uint8Array> {
  const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
  return new Map([
    ["ppt/presentation.xml", xml(presentation)],
    ["ppt/_rels/presentation.xml.rels", xml(rels)],
    ["ppt/slides/slide1.xml", slide],
  ])
}

function editedRegister(edits: readonly (readonly [string, string])[]): Register {
  let register = openRegister("", "clean")
  for (const [id, value] of edits) {
    if (!register.nodes.includes(elementId(id))) {
      const added = decide(register, { command: "add", node: elementId(id), floor: "", route: register.route })
      if (added.decision === "refuse") throw new Error("refused")
      register = added.register
    }
    const edited = decide(register, { command: "person", value, node: elementId(id) })
    if (edited.decision === "refuse") throw new Error("refused")
    register = edited.register
  }
  return register
}

const twoBoxSlide = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>World</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`

it("an export skips an element whose only rows were undone", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const node = elementId("256.2")
  let register = openRegister("", "clean")
  for (const command of [
    { command: "add", node, floor: "", route: "clean" },
    { command: "start", node, runId: "run" },
    { command: "agent", node, runId: "run", readAt: 0, value: "gone" },
    { command: "undo", node, runId: "run" },
  ] as const) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error("refused")
    register = decision.register
  }
  expect(exportedParts(parts, register)).toBe(parts)
})

it("an export with no stored edit applies no route and keeps the stored parts", () => {
  const slide = xml(twoBoxSlide)
  const parts = onSlide(slide)
  expect(exportedParts(parts, openRegister("", "clean"))).toBe(parts)
  const next = exportedParts(parts, editedRegister([["256.2", "Hello!"]]))
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml")).match(/<a:t>[^<]*<\/a:t>/g)).toEqual([
    "<a:t>Hello!</a:t>",
    "<a:t>World</a:t>",
  ])
  expect([...next.keys()].sort()).toEqual([...parts.keys()].sort())
  expect(next.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
  expect(parts.get("ppt/slides/slide1.xml")).toBe(slide)
})

it("an export writes each edited element into its own box", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const next = exportedParts(
    parts,
    editedRegister([
      ["256.3", "Planet"],
      ["256.2", "Hi"],
      ["256.3", "Earth"],
    ]),
  )
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml")).match(/<a:t>[^<]*<\/a:t>/g)).toEqual([
    "<a:t>Hi</a:t>",
    "<a:t>Earth</a:t>",
  ])
})

it("saves every edit under the deck id in the address", async () => {
  await committedNodes(shapedParts(), "Keep", ["Next", "Later"], "address-deck")
  expect(live.sent.map((edit) => edit.deck)).toEqual(["address-deck", "address-deck"])
  expect(live.reads).toContain("address-deck")
})

it("saves two opened files under distinct valid deck ids", async () => {
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

it("an export writes a stored value with several paragraphs and a value the route refuses writes nothing", () => {
  const lines = Array.from({ length: 9 }, (_, index) => `<a:p><a:r><a:t>Line ${index}</a:t></a:r></a:p>`).join("")
  const slide = new TextEncoder().encode(
    `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr><p:txBody><a:bodyPr/>${lines}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  )
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  const value = Array.from({ length: 9 }, (_, index) => ({
    from: index,
    runs: [{ from: 0, text: index === 3 ? "typed" : `Line ${index}` }],
  }))
  const next = exportedParts(parts, editedRegister([["256.2", writeTextValue(value)]]))
  expect(new TextDecoder().decode(next.get("ppt/slides/slide1.xml"))).toBe(
    new TextDecoder().decode(slide).replace("Line 3", "typed"),
  )
  const outside = writeTextValue([{ from: 9, runs: [{ from: 0, text: "typed" }] }])
  expect(() => exportedParts(parts, editedRegister([["256.2", outside]]))).toThrow(/text-paragraph/)
  expect(parts.get("ppt/slides/slide1.xml")).toEqual(saved)
})

const fallbackSlide = `<p:sld><p:cSld><p:spTree><mc:AlternateContent><mc:Choice Requires="x"><p:sp><p:nvSpPr><p:cNvPr id="6" name="C"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Choice</a:t></a:r></a:p></p:txBody></p:sp></mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="2" name="F"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>One</a:t></a:r></a:p><a:p><a:r><a:rPr b="1"/><a:t>Two</a:t></a:r></a:p><a:p><a:r><a:t>Three</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent><p:sp><p:nvSpPr><p:cNvPr id="2" name="P"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Keep</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`

it("an export of a stored edit refuses the fallback box that shares the edited id and writes nothing", () => {
  const slide = new TextEncoder().encode(fallbackSlide)
  const saved = Uint8Array.from(slide)
  const parts = onSlide(slide)
  expect(() => exportedParts(parts, editedRegister([["256.2", "typed"]]))).toThrow(/text-shape/)
  expect(parts.get("ppt/slides/slide1.xml")).toEqual(saved)
})

function editableTexts(window: Window): readonly string[] {
  return [...window.document.querySelectorAll('[contenteditable="true"]')].map((node) => node.textContent ?? "").sort()
}

it("does not offer a locked box for editing", async () => {
  const parts = shapedParts()
  parts.set("ppt/slides/slide1.xml", xml(fallbackSlide))
  const window = await renderedDeck(parts)
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(editableTexts(window)).toEqual(["Choice", "Other"])
})

async function offeredWith(body: string) {
  const parts = shapedParts()
  const slide = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  const keep = "<p:txBody><a:p><a:r><a:t>Keep</a:t></a:r></a:p></p:txBody>"
  expect(slide).toContain(keep)
  parts.set("ppt/slides/slide1.xml", xml(slide.replace(keep, `<p:txBody>${body}</p:txBody>`)))
  return renderedDeck(parts)
}

it("offers a box with two runs in one paragraph for editing and shows each run", async () => {
  const window = await offeredWith("<a:p><a:r><a:t>Ke</a:t></a:r><a:r><a:t>ep</a:t></a:r></a:p>")
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("true")
  expect([...(shown?.querySelectorAll("[data-run]") ?? [])].map((run) => run.textContent)).toEqual(["Ke", "ep"])
  expect(editableTexts(window)).toEqual(["First", "Keep", "Last", "Other"])
})

it("offers a box with several paragraphs for editing and shows each paragraph", async () => {
  const window = await offeredWith("<a:p><a:r><a:t>Ke</a:t></a:r></a:p><a:p><a:r><a:t>ep</a:t></a:r></a:p>")
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("true")
  expect([...(shown?.querySelectorAll("[data-paragraph]") ?? [])].map((run) => run.textContent)).toEqual(["Ke", "ep"])
  expect(editableTexts(window)).toEqual(["First", "Keep", "Last", "Other"])
})

it("offers an empty box for editing", async () => {
  const window = await offeredWith('<a:p><a:endParaRPr lang="en-US"/></a:p>')
  expect(editableTexts(window)).toEqual(["", "First", "Last", "Other"])
})

it("does not offer a slide-number box for editing", async () => {
  const window = await offeredWith(`<a:p><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>Keep</a:t></a:fld></a:p>`)
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(editableTexts(window)).toEqual(["First", "Last", "Other"])
})

it("names every element by its slide id and shape id in the server's pattern", () => {
  const ids = elementIds(shapedParts())
  expect(ids).toEqual(["452.2", "382.5", "382.2", "382.9"])
  for (const id of ids) expect(id).toMatch(/^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/)
})

it("commits each box under its own id with its file text as floor", async () => {
  const window = await renderedDeck(shapedParts())
  await typeInto(window, boxShowing(window, "First"), "One", 2)
  await typeInto(window, boxShowing(window, "Last"), "Two", 3)
  await typeInto(window, boxShowing(window, "Other"), "Three", 4)
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
  expect(editableTexts(window)).toEqual(["First", "Keep", "Stored last", "Stored other"])
})

it("sends what is pending when a deck opens", async () => {
  await renderedDeck(shapedParts(), "address-deck")
  expect(live.flushed).toEqual(["address-deck"])
})

it("puts a refused edit back to the last stored text", async () => {
  const window = await renderedDeck(shapedParts(), "opened-deck", editedRegister([["382.9", "Stored last"]]))
  live.state.refuse = true
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

it("keeps what was typed while the opened file was still loading", async () => {
  const window = await renderedDeck(await cleanParts(), undefined)
  let release: () => void = () => undefined
  live.state.gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const input = window.document.querySelector("input[type=file]")
  if (input === null) throw new Error("input")
  Object.defineProperty(input, "files", { value: [new File([Uint8Array.from(await cleanFile())], "clean.pptx")] })
  const saved = live.reached("putParts", 1)
  await act(async () => {
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    await saved
  })
  await act(async () => {})
  const box = boxShowing(window, "Hello")
  await typeInto(window, box, "Typed while held", 1)
  await act(async () => {
    release()
    await live.state.gate
  })
  await act(async () => {})
  expect(box.textContent).toBe("Typed while held")
  expect(live.sent.map((edit) => edit.value)).toEqual([oneRun("Typed while held")])
  expect(live.sent[0]?.deck).toBe(live.saved[0]?.deck)
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
  const shown = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === "Keep")
  expect(shown?.getAttribute("contenteditable")).toBe("false")
  expect(editableTexts(window)).toEqual(["Choice", "Other"])
})
