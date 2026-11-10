import { decide, elementId, openRegister } from "@airdesign/document"
import type { Remote } from "@airdesign/live"
import { readPackage, readShapes } from "@airdesign/pptx"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { commitEdit, elementNode, exportedParts, nodeA, saveDeck, ThinDeck } from "./thin-deck"

const live = vi.hoisted(() => {
  const sent: { deck: string; value: string; node?: string }[] = []
  const saved: { deck: string; parts: ReadonlyMap<string, Uint8Array>; nodes: unknown }[] = []
  const reads: string[] = []
  const state: {
    parts:
      | {
          ok: true
          parts: ReadonlyMap<string, Uint8Array>
          nodes: { a: { part: string; shape: string } }
        }
      | { ok: false; refusal: "absent" }
  } = { parts: { ok: false, refusal: "absent" } }
  const counts = { openDeck: 0, flush: 0 }
  let waiters: { kind: "openDeck" | "flush"; count: number; resolve: () => void }[] = []
  function happened(kind: "openDeck" | "flush") {
    counts[kind] += 1
    for (const waiter of waiters) if (waiter.kind === kind && counts[kind] >= waiter.count) waiter.resolve()
    waiters = waiters.filter((waiter) => waiter.kind !== kind || counts[kind] < waiter.count)
  }
  return {
    sent,
    saved,
    reads,
    state,
    reset() {
      sent.length = 0
      reads.length = 0
      saved.length = 0
      counts.openDeck = 0
      counts.flush = 0
      waiters = []
    },
    reached(kind: "openDeck" | "flush", count: number): Promise<void> {
      if (counts[kind] >= count) return Promise.resolve()
      return new Promise((resolve) => {
        waiters.push({ kind, count, resolve })
      })
    },
    getParts: async (deck: string) => {
      reads.push(deck)
      return state.parts
    },
    putParts: async (
      deck: string,
      stored: { parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array; nodes: unknown },
    ) => {
      saved.push({ deck, parts: stored.parts, nodes: stored.nodes })
      return { ok: true, ...stored }
    },
    connect: () => ({
      async enqueue(deck: string, value: string, node?: string) {
        sent.push({ deck, value, node })
        return { ok: true, painted: "" }
      },
      async flush() {
        happened("flush")
        return { ok: true }
      },
      async openDeck() {
        happened("openDeck")
        return { ok: false, refusal: "deck" }
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
    putParts: (deck: string, stored: { parts: ReadonlyMap<string, Uint8Array>; file: Uint8Array; nodes: unknown }) =>
      live.putParts(deck, stored),
  }
})

const editedId = (async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const id = elementNode(readShapes(read.parts), nodeA)
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

it("flushes the http remote for the given deck after Hello! on node a", async () => {
  const node = await editedId
  const calls: { op: "enqueue" | "flush"; remote: Remote; deck: string; value?: string; node?: string }[] = []
  await commitEdit(
    (remote) => {
      return {
        async enqueue(deck, value, named) {
          calls.push({ op: "enqueue", remote, deck, value, node: named })
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
    node,
  )
  const enqueued = calls[0]
  const flushed = calls[1]
  expect(calls.map((call) => call.op)).toEqual(["enqueue", "flush"])
  expect(enqueued).toMatchObject({ deck: "different-deck", value: "Hello!", node })
  expect(flushed).toMatchObject({ deck: "different-deck" })
  if (enqueued === undefined || flushed === undefined) return
  expect(await postsCommit(enqueued.remote, "different-deck", node)).toBe(false)
  expect(await postsCommit(flushed.remote, "different-deck", node)).toBe(true)
})

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

async function committedNodes(
  parts: ReadonlyMap<string, Uint8Array>,
  from: string,
  values: readonly string[],
  deck = "opened-deck",
): Promise<readonly (string | undefined)[]> {
  live.reset()
  live.state.parts = { ok: true, parts, nodes: { a: nodeA } }
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
  const opened = live.reached("openDeck", 1)
  await act(async () => {
    root.render(<ThinDeck id={deck} />)
  })
  await act(async () => {
    await opened
  })
  const passage = [...window.document.querySelectorAll("[contenteditable]")].find((node) => node.textContent === from)
  if (passage === undefined) throw new Error("passage")
  for (const [index, value] of values.entries()) {
    passage.textContent = value
    const flushed = live.reached("flush", index + 1)
    await act(async () => {
      passage.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
      await flushed
    })
  }
  return live.sent.map((edit) => edit.node)
}

it("saves the thin edit under its element id", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  expect(await committedNodes(read.parts, "Hello", ["Hello!"])).toEqual(["256.2"])
})

it("saves under the id of the shape that was edited, not the first one", async () => {
  expect(await committedNodes(shapedParts(), "Keep", ["Next"])).toEqual(["382.2"])
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
    "256.2",
    () => {
      order.push("paint")
    },
  )
  await flushSent
  expect(order).toEqual(["enqueue", "paint", "flush"])
})

const oneSlidePresentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`
const oneSlideRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`

it("an export with no stored edit applies no route and keeps the stored parts", () => {
  const node = { part: "ppt/slides/slide1.xml", shape: "2" }
  const slide = new TextEncoder().encode(
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
  )
  const parts = new Map([
    ["ppt/presentation.xml", new TextEncoder().encode(oneSlidePresentation)],
    ["ppt/_rels/presentation.xml.rels", new TextEncoder().encode(oneSlideRels)],
    [node.part, slide],
  ])
  const empty = openRegister("", "clean")

  expect(exportedParts(parts, node, empty)).toBe(parts)

  const edited = decide(empty, { command: "person", value: "Hello!" })
  if (edited.decision === "refuse") throw new Error("refused")
  const next = exportedParts(parts, node, edited.register)
  expect(new TextDecoder().decode(next.get(node.part)).match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello!</a:t>"])
  expect([...next.keys()]).toEqual([...parts.keys()])
  expect(next.get("ppt/presentation.xml")).toBe(parts.get("ppt/presentation.xml"))
  expect(parts.get(node.part)).toBe(slide)
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
    { deck: first, parts: firstParts, nodes: { a: nodeA } },
    { deck: second, parts: secondParts, nodes: { a: nodeA } },
  ])
})

it("an export of a stored edit refuses a box with several paragraphs and writes nothing", () => {
  const node = { part: "ppt/slides/slide1.xml", shape: "2" }
  const lines = Array.from({ length: 9 }, (_, index) => `<a:p><a:r><a:t>Line ${index}</a:t></a:r></a:p>`).join("")
  const slide = new TextEncoder().encode(
    `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr><p:txBody><a:bodyPr/>${lines}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  )
  const saved = Uint8Array.from(slide)
  const parts = new Map([
    ["ppt/presentation.xml", new TextEncoder().encode(oneSlidePresentation)],
    ["ppt/_rels/presentation.xml.rels", new TextEncoder().encode(oneSlideRels)],
    [node.part, slide],
  ])
  const edited = decide(openRegister("", "clean"), { command: "person", value: "typed" })
  if (edited.decision === "refuse") throw new Error("refused")
  expect(() => exportedParts(parts, node, edited.register)).toThrow(/text-shape/)
  expect(parts.get(node.part)).toEqual(saved)
})
