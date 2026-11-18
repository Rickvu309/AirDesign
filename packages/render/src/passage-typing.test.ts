import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { elementId, readTextValue, writeTextValue } from "@airdesign/document"
import { afterEach, expect, it } from "vitest"
import { Passage, paintStore } from "./index.js"

afterEach(() => {
  document.body.replaceChildren()
})

it("typing after an empty run fills that run instead of adding one", async () => {
  const store = paintStore()
  const id = elementId("1.1")
  await act(async () => {
    store.publish({
      id,
      kind: "shape",
      text: writeTextValue([{ from: 0, runs: [{ from: 0, text: "" }] }]),
    })
  })
  const sent: string[] = []
  const host = document.createElement("div")
  document.body.append(host)
  await act(async () => {
    createRoot(host).render(createElement(Passage, { store, id, onEdit: (next) => void sent.push(next) }))
  })
  const editor = host.querySelector<HTMLElement>("[contenteditable]")
  const paragraph = editor?.querySelector("[data-paragraph]")
  const empty = editor?.querySelector("[data-run]")
  if (editor === null || !(paragraph instanceof HTMLElement) || !(empty instanceof HTMLElement))
    throw new Error("missing run")
  const typed = document.createTextNode("Hi")
  paragraph.replaceChildren(empty, typed)
  const type = (text: string) =>
    act(async () => {
      typed.nodeValue = text
      editor.focus()
      window.getSelection()?.collapse(typed, text.length)
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
    })
  await type("Hi")
  await type("Hi!")
  expect(sent.map((text) => readTextValue(text))).toEqual([
    [{ from: 0, runs: [{ from: 0, text: "Hi" }] }],
    [{ from: 0, runs: [{ from: 0, text: "Hi!" }] }],
  ])
})
