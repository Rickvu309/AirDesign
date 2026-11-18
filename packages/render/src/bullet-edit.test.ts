import { elementId, readTextValue, writeTextValue, type TextValue } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import type { CanvasText } from "./record.js"
import { SlideCanvas } from "./slide-canvas.js"
import { paintStore } from "./store.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const words: TextValue = [
  { from: 0, runs: [{ from: 0, text: "One" }] },
  { from: 1, runs: [{ from: 0, text: "Two" }] },
]

const text: CanvasText = {
  paragraphs: [0, 1].map((from) => ({
    from,
    align: "left" as const,
    marginLeft: 228_600,
    indent: -228_600,
    bullet: { autoNumber: "arabicPeriod", number: from + 1, font: null, color: null, size: null },
    runs: [
      { from: 0, text: from === 0 ? "One" : "Two", font: null, size: 203_200, bold: false, italic: false, color: null },
    ],
    endStyle: { font: null, size: 203_200, bold: false, italic: false, color: null },
  })),
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
}

async function mount(onEdit: (value: string) => void) {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: writeTextValue(words), picture: null })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        width: 800,
        onEdit: (_id, value) => onEdit(value),
        slide: {
          width: 12_192_000,
          height: 6_858_000,
          background: null,
          elements: [
            {
              key: id,
              id,
              kind: "shape",
              box: { x: 0, y: 0, width: 4_000_000, height: 2_000_000, rotation: 0, flipH: false, flipV: false },
              editable: true,
              placeholder: false,
              filled: false,
              fill: null,
              line: null,
              outline: "box",
              text,
            },
          ],
        },
      }),
    )
  })
  const editor = host.querySelector<HTMLElement>('[contenteditable="true"]')
  if (editor === null) throw new Error("no editor")
  return editor
}

function caret(node: Text, offset: number) {
  const selection = window.getSelection()
  if (selection === null) throw new Error("no selection")
  const range = document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

it("keeps a bullet out of the caret, Enter and Backspace", async () => {
  const sent: string[] = []
  const editor = await mount((value) => sent.push(value))
  const blocks = [...editor.querySelectorAll<HTMLElement>("[data-paragraph]")]
  expect(blocks.map((block) => block.style.getPropertyValue("--bullet"))).toEqual(['"1."', '"2."'])
  expect(editor.textContent).toBe("OneTwo")
  const first = blocks[0]?.querySelector("[data-run]")?.firstChild
  if (!(first instanceof Text)) throw new Error("no text")
  caret(first, 3)
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
  await act(async () => {
    editor.dispatchEvent(enter)
  })
  expect(enter.defaultPrevented).toBe(true)
  expect(readTextValue(sent.at(-1) ?? "")).toEqual([
    { from: 0, runs: [{ from: 0, text: "One" }] },
    { from: 0, runs: [{ from: 0, text: "" }] },
    { from: 1, runs: [{ from: 0, text: "Two" }] },
  ])
  const empty = editor.querySelectorAll("[data-paragraph]")[1]
  if (empty === undefined) throw new Error("no second paragraph")
  expect((empty as HTMLElement).style.getPropertyValue("--bullet")).not.toBe("none")
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(empty, 0)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const backspace = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })
  await act(async () => {
    editor.dispatchEvent(backspace)
  })
  expect(backspace.defaultPrevented).toBe(true)
  expect(readTextValue(sent.at(-1) ?? "")).toEqual(words)
  expect(sent.every((value) => !value.includes("1.") && !value.includes("•"))).toBe(true)
})
