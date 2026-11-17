import {
  decide,
  elementId,
  format,
  landedPatch,
  openRegister,
  themeNode,
  type Command,
  type ElementId,
  type Register,
  type Row,
} from "@airdesign/document"
import { readParts, readSlides } from "@airdesign/pptx"
import { act, createElement } from "react"
import { toast } from "sonner"
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
  const shown = editor.useDeckPaint(deck, pictures, { show: nothing })
  props.exposed(shown)
  return createElement(editor.LiveDesignPanel, {
    deck: {
      id: deck,
      shown,
      undo,
      selection: { ids: props.node === null ? [] : [props.node], inside: null },
      record: nothing,
      settle: nothing,
      setPending: nothing,
    },
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

async function pictureDeck(refused = false) {
  const parts = await readParts(await fixtureFile("picture-png.pptx"))
  const slide = readSlides(parts)[0]?.slide
  if (slide === undefined) throw new Error("slide")
  const node = elementId(`${slide}.4`)
  let register = openRegister("", "")
  const held: (() => void)[] = []
  device.link = {
    enqueueRow(_deck: string, row: Row, at: ElementId, floor: string) {
      if (refused) return Promise.resolve({ ok: false, refusal: "field" })
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
    side,
    unfold() {
      const button = [...host.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Name and alt text"),
      )
      if (button === undefined) throw new Error("Name and alt text")
      if (button.getAttribute("aria-expanded") !== "true") button.click()
    },
    entered(name: string, text: string) {
      const input = side(name)
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, text)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    },
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
  for (const name of ["Dark 1", "Accent 1", "Accent 6"]) expect(text.split(name)).toHaveLength(2)
  await slide.close()
}, 20_000)

it("draws a fill that names a theme colour in that colour once the theme changes it, as the canvas paints it", async () => {
  const parts = await readParts(await fixtureFile("clean.pptx"))
  const slide = readSlides(parts)[0]?.slide
  if (slide === undefined) throw new Error("slide")
  const node = elementId(`${slide}.2`)
  const opened = applied(openRegister("", "deck"), { command: "add", node: themeNode, floor: "", route: "deck" })
  const red = "C00000"
  const patch = { theme: { accent1: { set: red } } }
  const register = applied(opened, { command: "person", node: themeNode, v: format, patch })
  device.link = { flush: async () => ({ ok: true }), openDeck: async () => ({ ok: true, register }) }
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
  const painted = shown.canvases.current(0)?.elements.find((element) => element.id === node)?.fill
  const fill = [...host.querySelectorAll("[data-control='union']")].find(
    (control) => control.firstElementChild?.textContent === "Fill",
  )
  const swatch = fill?.querySelector<HTMLElement>("[data-control='color'] span[aria-hidden]")?.style.background
  expect(painted).toBe(`#${red}`)
  expect(swatch).toBe("rgb(192, 0, 0)")
  await act(async () => root.unmount())
  host.remove()
}, 20_000)

it("tells a person how to continue when a design-panel edit is refused", async () => {
  const error = vi.spyOn(toast, "error")
  const picture = await pictureDeck(true)
  try {
    await act(async () => picture.typed("Left", "10"))
    await picture.answered()
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Unable to make that change. Select the element and try again, or reload the deck if it keeps happening.",
      { duration: Infinity, closeButton: true },
    )
    expect(picture.landed()).toEqual({})
  } finally {
    error.mockRestore()
    await picture.close()
  }
}, 20_000)

function problem(input: HTMLInputElement): string | null {
  if (input.getAttribute("aria-invalid") !== "true") return null
  const id = input.getAttribute("aria-describedby")
  return id === null ? "" : (input.ownerDocument.getElementById(id)?.textContent ?? "")
}

it("keeps text typed before the end of a full Name and saves only once it fits", async () => {
  const picture = await pictureDeck()
  const full = "A".repeat(199) + "Z"
  try {
    await act(async () => picture.unfold())
    const name = picture.side("Name")
    await act(async () => picture.entered("Name", full))
    await act(async () => name.dispatchEvent(new window.Event("focusout", { bubbles: true })))
    await picture.answered()
    expect(picture.landed().identity?.name).toEqual({ set: full })

    await act(async () => picture.entered("Name", "X" + full))
    expect(name.value).toBe("X" + full)
    expect(problem(name)).toBe("Use 200 characters or fewer.")
    await act(async () => {
      name.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      name.dispatchEvent(new window.Event("focusout", { bubbles: true }))
    })
    await picture.answered()
    expect(name.value).toBe("X" + full)
    expect(picture.landed().identity?.name).toEqual({ set: full })

    await act(async () => picture.entered("Name", "X" + full.slice(1)))
    expect(problem(name)).toBeNull()
    await act(async () => name.dispatchEvent(new window.Event("focusout", { bubbles: true })))
    await picture.answered()
    expect(picture.landed().identity?.name).toEqual({ set: "X" + full.slice(1) })
  } finally {
    await picture.close()
  }
}, 20_000)

it.each([
  ["Name", "A".repeat(200), null],
  ["Name", "A".repeat(201), "Use 200 characters or fewer."],
  ["Name", "é".repeat(101), "Use 200 characters or fewer. Some letters and emoji count as 2 to 4."],
  ["Name", "A".repeat(197) + "😀", "Use 200 characters or fewer. Some letters and emoji count as 2 to 4."],
  ["Alt text", "😀".repeat(1000), null],
  ["Alt text", "😀".repeat(1001), "Use 4,000 characters or fewer. Some letters and emoji count as 2 to 4."],
])(
  "keeps %s input whole and says when it is over its document byte limit",
  async (label, typed, said) => {
    const picture = await pictureDeck()
    try {
      await act(async () => picture.unfold())
      const field = picture.side(label)
      await act(async () => picture.entered(label, typed))
      expect(field.value).toBe(typed)
      expect(problem(field)).toBe(said)
      await act(async () => field.dispatchEvent(new window.Event("focusout", { bubbles: true })))
      await picture.answered()
      expect(field.value).toBe(typed)
      expect(picture.landed().identity?.[label === "Name" ? "name" : "alt"]).toEqual(
        said === null ? { set: typed } : undefined,
      )
    } finally {
      await picture.close()
    }
  },
  20_000,
)

it("keeps a Name draft while Enter confirms an input-method composition", async () => {
  const picture = await pictureDeck()
  try {
    await act(async () => picture.unfold())
    await act(async () => picture.entered("Name", "名前"))
    await act(async () =>
      picture.side("Name").dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    )
    await picture.answered()
    expect(picture.side("Name").value).toBe("名前")
    expect(picture.landed()).toEqual({})
  } finally {
    await picture.close()
  }
}, 20_000)
