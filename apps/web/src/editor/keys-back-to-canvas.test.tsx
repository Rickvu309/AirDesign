import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { useKeysBackToCanvas } from "@/editor/keys-back-to-canvas"

let domWindow: Window & typeof globalThis
let mounted: { readonly host: HTMLDivElement; readonly root: Root } | null = null

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
  }
  domWindow = new jsdom.JSDOM("<!doctype html><html><body></body></html>").window
  const shared: [string, unknown][] = [
    ["window", domWindow],
    ["document", domWindow.document],
    ["HTMLElement", domWindow.HTMLElement],
    ["HTMLInputElement", domWindow.HTMLInputElement],
    ["Element", domWindow.Element],
    ["Node", domWindow.Node],
    ["KeyboardEvent", domWindow.KeyboardEvent],
    ["FocusEvent", domWindow.FocusEvent],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterEach(async () => {
  const now = mounted
  mounted = null
  if (now !== null) {
    await act(async () => now.root.unmount())
    now.host.remove()
  }
  document.body.replaceChildren()
})

afterAll(() => {
  vi.unstubAllGlobals()
  domWindow.close()
})

async function editor() {
  document.body.innerHTML = `
    <div data-slide-paint tabindex="-1"><div id="layer" tabindex="-1"><div id="text" contenteditable="true"></div></div></div>
    <div data-design-panel><input id="rotation"><button id="shape" aria-haspopup="listbox"></button></div>
    <div data-slot="select-content"><div role="option" tabindex="-1" id="ellipse"></div></div>`
  const at = (id: string) => document.getElementById(id)!
  function Harness() {
    useKeysBackToCanvas(true, () => at("layer"))
    return null
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
  mounted = { host, root }
  return at
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    await new Promise((done) => setTimeout(done))
  })
}

it.each(["Enter", "Escape"])(
  "hands the keys back to the selected layer after %s in a control, as Figma does",
  async (key) => {
    const at = await editor()
    at("rotation").focus()
    await press(at("rotation"), "l")
    expect(document.activeElement).toBe(at("rotation"))
    await press(at("rotation"), key)
    expect(document.activeElement).toBe(at("layer"))
  },
)

it("hands the keys back to the text being edited when the person left it for a control", async () => {
  const at = await editor()
  at("text").focus()
  at("rotation").focus()
  await press(at("rotation"), "Enter")
  expect(document.activeElement).toBe(at("text"))
})

it("keeps the keys in a control whose typed value was refused, so the person can fix it", async () => {
  const at = await editor()
  at("rotation").setAttribute("aria-invalid", "true")
  at("rotation").focus()
  await press(at("rotation"), "Enter")
  expect(document.activeElement).toBe(at("rotation"))
})

it("hands the keys back to the selected layer once a picker returns focus to its trigger, as Figma does", async () => {
  const at = await editor()
  at("ellipse").focus()
  await act(async () => {
    at("ellipse").blur()
    at("shape").focus()
    await new Promise((done) => setTimeout(done))
  })
  expect(document.activeElement).toBe(at("layer"))
})

it("hands the keys back before the next click or key can arrive, so reopening a picker at once keeps it open", async () => {
  const at = await editor()
  at("ellipse").focus()
  at("ellipse").blur()
  at("shape").focus()
  await Promise.resolve()
  expect(document.activeElement).toBe(at("layer"))
  at("rotation").focus()
  at("rotation").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
  await Promise.resolve()
  await Promise.resolve()
  expect(document.activeElement).toBe(at("layer"))
})

it("leaves the keys alone while another picker is open, so a late focus return cannot close it", async () => {
  const at = await editor()
  at("ellipse").focus()
  at("ellipse").blur()
  document.body.insertAdjacentHTML("beforeend", '<div data-slot="dropdown-menu-content" data-open></div>')
  at("shape").focus()
  await Promise.resolve()
  expect(document.activeElement).toBe(at("shape"))
})

it("leaves the keys on a trigger the person clicks after a picker closed to nothing", async () => {
  const at = await editor()
  at("ellipse").focus()
  at("ellipse").blur()
  at("shape").dispatchEvent(new window.Event("pointerdown", { bubbles: true }))
  at("shape").focus()
  await Promise.resolve()
  expect(document.activeElement).toBe(at("shape"))
})

it("keeps the keys on the trigger when the person worked the picker with the keyboard", async () => {
  const at = await editor()
  at("ellipse").focus()
  await act(async () => {
    at("ellipse").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    at("ellipse").blur()
    at("shape").focus()
    await new Promise((done) => setTimeout(done))
  })
  expect(document.activeElement).toBe(at("shape"))
})

it("leaves the keys on a picker trigger the person moved to themselves", async () => {
  const at = await editor()
  at("rotation").focus()
  await act(async () => {
    at("shape").focus()
    await new Promise((done) => setTimeout(done))
  })
  expect(document.activeElement).toBe(at("shape"))
})
