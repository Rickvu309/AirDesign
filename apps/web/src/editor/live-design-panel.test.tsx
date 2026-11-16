import {
  decide,
  elementId,
  landedPatch,
  openRegister,
  type Command,
  type ElementId,
  type Register,
  type Row,
} from "@airdesign/document"
import { readParts, readSlides } from "@airdesign/pptx"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import type { DeckPaint } from "./use-deck-paint"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

const deck = "picture-deck"
let window: Window & typeof globalThis
let editor: {
  readonly createRoot: typeof import("react-dom/client").createRoot
  readonly LiveDesignPanel: typeof import("./live-design-panel").LiveDesignPanel
  readonly useDeckPaint: typeof import("./use-deck-paint").useDeckPaint
  readonly useUndoList: typeof import("./use-undo").useUndoList
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function Panel(props: { readonly node: ElementId | null; readonly exposed: (shown: DeckPaint) => void }) {
  const nothing = () => undefined
  const pictures = { store: { bytes: new Map(), load: async () => false, keep: nothing } }
  const undo = editor.useUndoList()
  const shown = editor.useDeckPaint(deck, pictures, { show: nothing }, nothing)
  props.exposed(shown)
  return createElement(editor.LiveDesignPanel, {
    deck: { id: deck, shown, undo, designing: props.node, record: nothing, settle: nothing, setPending: nothing },
  })
}

async function fixtureFile(name: string): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url))
}

async function slidePanel() {
  const parts = await readParts(await fixtureFile("blank.pptx"))
  const register = openRegister("", "")
  device.link = {
    enqueueRow: async () => ({ ok: true }),
    flush: async () => ({ ok: true }),
    openDeck: async () => ({ ok: true, register }),
  }
  const exposed: { current: DeckPaint | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = editor.createRoot(host)
  await act(async () => root.render(createElement(Panel, { node: null, exposed: (now) => (exposed.current = now) })))
  const shown = exposed.current
  if (shown === null) throw new Error("not rendered")
  await act(async () => {
    shown.showOpened(parts, register)
  })
  return {
    host,
    close: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

async function pictureDeck() {
  const parts = await readParts(await fixtureFile("picture-png.pptx"))
  const slide = readSlides(parts)[0]?.slide
  if (slide === undefined) throw new Error("slide")
  const node = elementId(`${slide}.4`)
  let register = openRegister("", "")
  const held: (() => void)[] = []
  device.link = {
    enqueueRow(_deck: string, row: Row, at: ElementId, floor: string) {
      if (register.elements[at] === undefined)
        register = applied(register, { command: "add", node: at, floor, route: "deck" })
      register = applied(register, { command: "person", node: at, ...row })
      return new Promise((resolve) => held.push(() => resolve({ ok: true })))
    },
    flush: async () => ({ ok: true }),
    openDeck: async () => ({ ok: true, register }),
  }
  const exposed: { current: DeckPaint | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = editor.createRoot(host)
  await act(async () => root.render(createElement(Panel, { node, exposed: (now) => (exposed.current = now) })))
  const shown = exposed.current
  if (shown === null) throw new Error("not rendered")
  await act(async () => {
    shown.showOpened(parts, register)
  })
  const side = (name: string) => {
    const input = host.querySelector<HTMLInputElement>(`[data-design-element] input[aria-label="${name}"]`)
    if (input === null) throw new Error(name)
    return input
  }
  return {
    typed(name: string, text: string) {
      const input = side(name)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, text)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    },
    async answered() {
      for (let turn = 0; turn < 20; turn += 1) {
        await act(async () => {
          for (const answer of held.splice(0)) answer()
          await new Promise((done) => setTimeout(done, 0))
        })
      }
    },
    landed: () => {
      const body = register.elements[node]
      return body === undefined ? {} : landedPatch(body, "text")
    },
    close: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["HTMLInputElement", window.HTMLInputElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["KeyboardEvent", window.KeyboardEvent],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  const [{ createRoot }, { LiveDesignPanel }, { useDeckPaint }, { useUndoList }] = await Promise.all([
    import("react-dom/client"),
    import("./live-design-panel"),
    import("./use-deck-paint"),
    import("./use-undo"),
  ])
  editor = { createRoot, LiveDesignPanel, useDeckPaint, useUndoList }
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("keeps both crop sides a person types one after another while the first is still landing", async () => {
  const picture = await pictureDeck()
  await act(async () => picture.typed("Left", "10"))
  await act(async () => picture.typed("Right", "10"))
  await picture.answered()
  const { crop, box } = picture.landed()
  expect(crop?.rect).toEqual({ set: { l: 10_000, t: 0, r: 10_000, b: 0 } })
  expect([box?.x, box?.w]).toEqual([{ set: 4_267_200 }, { set: 3_657_600 }])
  await picture.close()
}, 20_000)

it("shows a slide's background and theme once each, with no section or button that does nothing", async () => {
  const slide = await slidePanel()
  const panel = slide.host.querySelector("[data-design-panel]")
  const text = panel?.textContent ?? ""
  expect(text).toContain("Background")
  expect(text).toContain("Theme")
  expect(text).not.toContain("Template")
  expect(text).not.toContain("not available")
  expect(panel?.querySelectorAll("button:disabled")).toHaveLength(0)
  expect(panel?.querySelectorAll("button[aria-label^='Background color']")).toHaveLength(1)
  for (const name of ["Dark 1", "Accent 1", "Accent 6"])
    expect(text.split(name)).toHaveLength(2)
  await slide.close()
}, 20_000)
