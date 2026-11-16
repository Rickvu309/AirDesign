import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { holdKeys, paintStore, SlideCanvas, type CanvasElement, type Entering } from "./index.js"

const hosts: { host: HTMLElement; root: Root }[] = []
const typed: { readonly into: Element | null; readonly command: string; readonly value: string }[] = []

beforeEach(() => {
  typed.length = 0
  Reflect.set(document, "execCommand", (command: string, _: boolean, value = "") => {
    typed.push({ into: document.activeElement, command, value })
    return true
  })
})

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const added = elementId("256.9")

function element(named: ElementId): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${named}`,
    id: named,
    kind: "shape",
    box: { x: 457_200, y: 457_200, width: 5_486_400, height: 1_828_800, rotation: 0, flipH: false, flipV: false },
    editable: true,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

async function painted() {
  const store = paintStore()
  store.publish({ id: added, kind: "shape", text: "", picture: null })
  const host = document.createElement("div")
  const button = document.createElement("button")
  document.body.append(button, host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const draw = (entering: Entering | null) =>
    act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [element(added)] },
          width: 800,
          entering,
          onEdit: () => undefined,
          onBoxes: () => undefined,
        }),
      )
    })
  await draw(null)
  button.focus()
  const text = host.querySelector<HTMLElement>('[contenteditable="true"]')
  if (text === null) throw new Error("no text")
  return { button, text, draw }
}

function press(target: Element, key: string): { down: boolean; up: boolean } {
  const down = target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
  const up = target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }))
  return { down, up }
}

function pressAll(target: Element, keys: string): void {
  for (const key of keys) press(target, key)
}

describe("holdKeys", () => {
  it("keeps keys pressed after the box paints and before it takes focus, and types them into the box", async () => {
    const { button, text, draw } = await painted()
    const keys = holdKeys(document)
    const heard: string[] = []
    const listen = (event: KeyboardEvent) => heard.push(event.key)
    window.addEventListener("keydown", listen)
    pressAll(button, "Big tx")
    expect(press(button, "Backspace")).toEqual({ down: false, up: false })
    pressAll(button, "itle")
    window.removeEventListener("keydown", listen)
    expect(heard).toEqual([])
    expect(document.activeElement).toBe(button)
    await draw({ id: added, keys })
    expect(document.activeElement).toBe(text)
    expect(typed).toEqual([{ into: text, command: "insertText", value: "Big title" }])
    expect(press(button, "a").down).toBe(true)
  })

  it("leaves keys that go into a text and keys with Control or Meta to their target", async () => {
    const { button, text } = await painted()
    const keys = holdKeys(document)
    expect(press(text, "a").down).toBe(true)
    expect(button.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true }))).toBe(true)
    expect(press(button, "Backspace").down).toBe(true)
    expect(keys.take()).toBe("")
  })

  it("stops holding when the person presses a pointer elsewhere, and keeps what it held", async () => {
    const { button, text, draw } = await painted()
    const keys = holdKeys(document)
    pressAll(button, "Hi")
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    expect(press(button, "x").down).toBe(true)
    await draw({ id: added, keys })
    expect(typed).toEqual([{ into: text, command: "insertText", value: "Hi" }])
  })

  it("stops holding on Escape or Tab and leaves those keys to the page", async () => {
    for (const key of ["Escape", "Tab"]) {
      const { button } = await painted()
      const keys = holdKeys(document)
      pressAll(button, "Hi")
      expect(press(button, key).down).toBe(true)
      expect(press(button, "x").down).toBe(true)
      expect(keys.take()).toBe("Hi")
    }
  })

  it("keeps text pasted outside a text and types its lines into the box", async () => {
    const { button, text, draw } = await painted()
    const keys = holdKeys(document)
    pressAll(button, "A")
    const pasted = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(pasted, "clipboardData", { value: { getData: () => "B\r\nC" } })
    expect(button.dispatchEvent(pasted)).toBe(false)
    await draw({ id: added, keys })
    expect(typed.map((each) => [each.into, each.value])).toEqual([
      [text, "AB"],
      [text, "C"],
    ])
  })

  it("stops holding when the insert is refused", async () => {
    const { button } = await painted()
    const keys = holdKeys(document)
    keys.stop()
    expect(press(button, "x").down).toBe(true)
  })

  it("types a held Enter as the box's own Enter between lines", async () => {
    const { button, text, draw } = await painted()
    const keys = holdKeys(document)
    pressAll(button, "Hi")
    expect(press(button, "Enter")).toEqual({ down: false, up: false })
    pressAll(button, "yo")
    const entered: boolean[] = []
    text.addEventListener("keydown", (event) => entered.push(event.key === "Enter"))
    await draw({ id: added, keys })
    expect(entered).toEqual([true])
    expect(typed.map((each) => each.value)).toEqual(["Hi", "yo"])
  })
})
