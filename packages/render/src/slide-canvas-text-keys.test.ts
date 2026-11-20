import { elementId, readTextValue, writeTextValue, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, textFormatting, type CanvasElement, type CanvasSlide } from "./index.js"
import type { TextEditKind } from "./passage.js"
import { selectionOf } from "./selection.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => mounted.root.unmount())
    mounted.host.remove()
  }
})

const labels = ["Jan", "Feb", "Mar"].map((word, index) => ({ word, id: elementId(`256.${String(index + 2)}`) }))

function label(id: ElementId, index: number): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind: "shape",
    box: {
      x: 457_200 + index * 1_828_800,
      y: 457_200,
      width: 1_524_000,
      height: 457_200,
      rotation: 0,
      flipH: false,
      flipV: false,
    },
    editable: true,
    movable: true,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

function sized(word: string, size: number): string {
  return writeTextValue([{ from: 0, runs: [{ from: 0, text: word, size }] }])
}

async function mounted() {
  const store = paintStore()
  for (const { word, id } of labels) store.publish({ id, kind: "shape", text: sized(word, 1800) })
  const formatting = textFormatting()
  const edits: { id: ElementId; value: string; kind: TextEditKind; together: object | null }[] = []
  const elements = labels.map(({ id }, index) => label(id, index))
  const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width: 800,
        formatting,
        onBoxes: () => undefined,
        selection: selectionOf(
          slide,
          labels.map(({ id }) => id),
        ),
        onEdit: (id: ElementId, value: string, kind: TextEditKind) => {
          edits.push({ id, value, kind, together: formatting.together() })
          store.publish({ id, kind: "shape", text: value })
        },
      }),
    )
  })
  const last = labels.at(-1)
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${String(last?.id)}"]`)
  if (frame === null) throw new Error("no frame")
  await act(async () => frame.focus())
  return { frame, edits }
}

function firstRun(value: string) {
  return readTextValue(value)?.[0]?.runs[0]
}

it("steps the size of every selected text layer on Ctrl+Shift+>, as one change", async () => {
  const { frame, edits } = await mounted()
  await act(async () => {
    frame.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: ">",
        code: "Period",
        ctrlKey: true,
        shiftKey: true,
      }),
    )
  })
  expect(edits.map(({ id }) => id).sort()).toEqual(labels.map(({ id }) => id).sort())
  expect(edits.every(({ kind }) => kind === "format")).toBe(true)
  expect(edits.map(({ value }) => firstRun(value)?.size)).toEqual([2000, 2000, 2000])
  const [first] = edits
  expect(first?.together).not.toBeNull()
  expect(edits.every(({ together }) => together === first?.together)).toBe(true)
})

it("makes every selected layer bold when one is not, then plain again", async () => {
  const { frame, edits } = await mounted()
  const bold = () =>
    act(async () => {
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "b", code: "KeyB", ctrlKey: true }),
      )
    })
  await bold()
  expect(edits.map(({ value }) => firstRun(value)?.bold)).toEqual([true, true, true])
  edits.length = 0
  await bold()
  expect(edits.map(({ value }) => firstRun(value)?.bold ?? false)).toEqual([false, false, false])
})
