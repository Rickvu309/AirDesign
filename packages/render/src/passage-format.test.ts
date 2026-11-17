import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { elementId, readTextValue, writeTextValue } from "@airdesign/document"
import { afterEach, expect, it } from "vitest"
import { Passage, paintStore, textFormatting } from "./index.js"

const roots: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of roots.splice(0)) {
    await act(async () => mounted.root.unmount())
    mounted.host.remove()
  }
})

const id = elementId("1.2")
const start = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello world" }] }])

async function mounted() {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: start, picture: null })
  let fresh = 0
  const formatting = textFormatting(() => {
    fresh += 1
  })
  const edits: string[] = []
  const kinds: string[] = []
  const host = document.createElement("div")
  host.tabIndex = 0
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ host, root })
  const onEdit = (value: string, kind: string) => {
    edits.push(value)
    kinds.push(kind)
    store.publish({ id, kind: "shape", text: value, picture: null })
  }
  await act(async () => root.render(createElement(Passage, { store, id, onEdit, formatting })))
  const editor = host.querySelector("[contenteditable]")
  if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
  return { host, editor, formatting, edits, kinds, fresh: () => fresh }
}

async function select(editor: HTMLElement, from: number, to: number) {
  editor.focus()
  const node = editor.querySelector("[data-run]")?.firstChild
  if (!(node instanceof Text)) throw new Error("missing text")
  const range = document.createRange()
  range.setStart(node, from)
  range.setEnd(node, to)
  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)
  await act(async () => document.dispatchEvent(new Event("selectionchange")))
}

it("makes the selected range bold as one text edit and keeps it selected", async () => {
  const { editor, formatting, edits, fresh } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  expect(formatting.state("bold")).toBe("off")
  await act(async () => formatting.toggle("bold"))
  expect(readTextValue(edits.at(-1) ?? "")).toEqual([
    {
      from: 0,
      runs: [
        { from: 0, text: "He" },
        { from: 0, text: "llo w", bold: true },
        { from: 0, text: "orld" },
      ],
    },
  ])
  expect(fresh()).toBe(2)
  expect(editor.querySelectorAll("[data-bold=true]")).toHaveLength(1)
  expect(window.getSelection()?.toString()).toBe("llo w")
  expect(formatting.state("bold")).toBe("on")
})

it("reports bold and Larger as format edits, never as text edits", async () => {
  const { editor, formatting, kinds } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  await act(async () => formatting.toggle("bold"))
  await act(async () => formatting.resize(1))
  expect(kinds).toEqual(["format", "format"])
})

it("turns a range back to the value it started from", async () => {
  const { editor, formatting, edits } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  await act(async () => formatting.toggle("italic"))
  await act(async () => formatting.toggle("italic"))
  expect(edits.at(-1)).toBe(start)
})

it("formats the whole box when the box is selected without a range", async () => {
  const { host, editor, formatting, edits } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, host)
  expect(formatting.state("underline")).toBe("off")
  await act(async () => formatting.toggle("underline"))
  expect(readTextValue(edits.at(-1) ?? "")).toEqual([
    { from: 0, runs: [{ from: 0, text: "Hello world", underline: true }] },
  ])
  expect(document.activeElement).toBe(host)
})

it("changes size, colour, alignment and bullets as separate edits and keeps the selection", async () => {
  const { editor, formatting, edits, fresh } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  await act(async () => formatting.resize(1))
  await act(async () => formatting.choose({ scheme: "accent1" }))
  await act(async () => formatting.place("center"))
  await act(async () => formatting.bullets())
  expect(fresh()).toBe(8)
  expect(readTextValue(edits.at(-1) ?? "")).toEqual([
    {
      from: 0,
      align: "center",
      bullet: true,
      runs: [
        { from: 0, text: "He" },
        { from: 0, text: "llo w", size: 2000, color: { scheme: "accent1" } },
        { from: 0, text: "orld" },
      ],
    },
  ])
  expect(editor.querySelector("[data-size='2000']")?.textContent).toBe("llo w")
  expect(editor.querySelector("[data-color='scheme:accent1']")).not.toBeNull()
  expect(editor.querySelector("[data-align='center']")).not.toBeNull()
  expect(editor.querySelector("[data-bullet='true']")).not.toBeNull()
  expect(window.getSelection()?.toString()).toBe("llo w")
  expect(formatting.size()).toBe(2000)
  expect(formatting.align()).toBe("center")
  expect(formatting.bullet()).toBe("on")
})

it("sets a typed size on the selection as one edit and keeps the selection", async () => {
  const { editor, formatting, edits, fresh } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  const next = document.createElement("button")
  editor.after(next)
  next.focus()
  await act(async () => formatting.sizeTo(1050, true))
  expect(document.activeElement).toBe(editor)
  expect(fresh()).toBe(2)
  expect(readTextValue(edits.at(-1) ?? "")).toEqual([
    {
      from: 0,
      runs: [
        { from: 0, text: "He" },
        { from: 0, text: "llo w", size: 1050 },
        { from: 0, text: "orld" },
      ],
    },
  ])
  expect(window.getSelection()?.toString()).toBe("llo w")
  expect(formatting.size()).toBe(1050)
})

it("sets a typed size on the kept selection and leaves focus where the person moved it", async () => {
  const { host, editor, formatting, edits } = await mounted()
  await select(editor, 2, 7)
  formatting.aim(id, editor)
  const next = document.createElement("button")
  host.after(next)
  next.focus()
  await act(async () => formatting.sizeTo(1050, false))
  expect(document.activeElement).toBe(next)
  expect(readTextValue(edits.at(-1) ?? "")).toEqual([
    {
      from: 0,
      runs: [
        { from: 0, text: "He" },
        { from: 0, text: "llo w", size: 1050 },
        { from: 0, text: "orld" },
      ],
    },
  ])
  next.remove()
})

it("gives no state when no box is aimed at", async () => {
  const { formatting } = await mounted()
  expect(formatting.state("bold")).toBeNull()
})

it("refuses the browser's own bold", async () => {
  const { editor } = await mounted()
  const event = new InputEvent("beforeinput", { inputType: "formatBold", cancelable: true, bubbles: true })
  editor.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})

it("puts focus and the selection back in the text after a button took focus", async () => {
  const { host, editor, formatting } = await mounted()
  await select(editor, 0, 5)
  formatting.aim(id, editor)
  const button = document.createElement("button")
  host.after(button)
  button.focus()
  await act(async () => formatting.toggle("bold"))
  expect(document.activeElement).toBe(editor)
  expect(window.getSelection()?.toString()).toBe("Hello")
  button.remove()
})

it("stays aimed while focus moves into the toolbar and lets go when it moves anywhere else", async () => {
  const { host, editor, formatting } = await mounted()
  const stop = formatting.subscribe(() => undefined)
  const toolbar = document.createElement("div")
  toolbar.dataset.keepsFormat = ""
  const undo = document.createElement("button")
  toolbar.append(undo)
  const elsewhere = document.createElement("button")
  host.after(toolbar, elsewhere)
  editor.focus()
  formatting.aim(id, editor)
  undo.focus()
  expect(formatting.state("bold")).toBe("off")
  elsewhere.focus()
  expect(formatting.state("bold")).toBeNull()
  stop()
  toolbar.remove()
  elsewhere.remove()
})
