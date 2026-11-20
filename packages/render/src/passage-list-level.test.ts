import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { elementId, readTextValue, writeTextValue, type TextParagraph, type TextValue } from "@airdesign/document"
import { afterEach, expect, it } from "vitest"
import { Passage, paintStore } from "./index.js"

afterEach(() => {
  document.body.replaceChildren()
})

async function mount(value: TextValue) {
  const store = paintStore()
  const id = elementId("1.1")
  await act(async () => {
    store.publish({ id, kind: "shape", text: writeTextValue(value) })
  })
  const sent: string[] = []
  const host = document.createElement("div")
  document.body.append(host)
  await act(async () => {
    createRoot(host).render(createElement(Passage, { store, id, onEdit: (next) => void sent.push(next) }))
  })
  const editor = host.querySelector<HTMLElement>("[contenteditable]")
  if (editor === null) throw new Error("no editor")
  return { editor, sent }
}

function caretIn(editor: HTMLElement, paragraph: number, offset: number) {
  const node = editor.querySelectorAll("[data-paragraph]")[paragraph]?.querySelector("[data-run]")?.firstChild
  editor.focus()
  if (node === null || node === undefined) {
    const block = editor.querySelectorAll("[data-paragraph]")[paragraph]
    if (block !== undefined) window.getSelection()?.collapse(block, 0)
    return
  }
  window.getSelection()?.collapse(node, offset)
}

async function press(editor: HTMLElement, key: string, held: KeyboardEventInit = {}): Promise<boolean> {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held })
  await act(async () => {
    editor.dispatchEvent(event)
  })
  return event.defaultPrevented
}

const one: TextParagraph = { from: 0, list: "bullets", runs: [{ from: 0, text: "One" }] }
const two: TextParagraph = { from: 1, list: "bullets", runs: [{ from: 0, text: "Two" }] }
const items: TextValue = [one, two]

it("indents the list item under the caret with Tab and outdents it with Shift Tab, as in Figma", async () => {
  const { editor, sent } = await mount(items)
  caretIn(editor, 1, 1)
  expect(await press(editor, "Tab")).toBe(true)
  expect(readTextValue(sent.at(-1) ?? "")?.[1]).toMatchObject({ list: "bullets", level: 1 })
  expect(editor.querySelectorAll<HTMLElement>("[data-paragraph]")[1]?.dataset.level).toBe("1")
  caretIn(editor, 1, 1)
  expect(await press(editor, "Tab", { shiftKey: true })).toBe(true)
  expect(readTextValue(sent.at(-1) ?? "")?.[1]).toEqual(two)
})

it("takes Figma's Command or Ctrl and the brackets as indent and outdent too", async () => {
  const { editor, sent } = await mount(items)
  caretIn(editor, 0, 2)
  expect(await press(editor, "]", { code: "BracketRight", ctrlKey: true })).toBe(true)
  expect(readTextValue(sent.at(-1) ?? "")?.[0]).toMatchObject({ level: 1 })
})

it("leaves Tab to the browser outside a list", async () => {
  const { editor, sent } = await mount([{ from: 0, runs: [{ from: 0, text: "Plain" }] }])
  caretIn(editor, 0, 2)
  expect(await press(editor, "Tab")).toBe(false)
  expect(sent).toEqual([])
})

it("outdents an empty indented list item on Enter instead of adding one, as Figma does", async () => {
  const { editor, sent } = await mount([one, { from: 1, list: "bullets", level: 1, runs: [{ from: 0, text: "" }] }])
  caretIn(editor, 1, 0)
  expect(await press(editor, "Enter")).toBe(true)
  const value = readTextValue(sent.at(-1) ?? "")
  expect(value?.length).toBe(2)
  expect(value?.[1]?.level).toBeUndefined()
})
