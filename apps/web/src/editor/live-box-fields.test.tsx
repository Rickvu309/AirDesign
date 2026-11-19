import { elementId, type ScopedElement } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { act, Fragment } from "react"
import type { Root } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { boxCopy } from "@/copy/box-copy"
import { panelOf, type PanelControl } from "@/design/panel"
import { ControlView } from "@/editor/design-panel"
import { LiveBoxFields } from "@/editor/live-box-fields"

const node = elementId("258.2")
const shape: ScopedElement = {
  node,
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: "Hello",
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}
const palette = { templateColors: [], deck: [] }

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>").window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["HTMLInputElement", window.HTMLInputElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  ;({ createRoot } = await import("react-dom/client"))
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function boxField(field: string): PanelControl {
  const control = panelOf(shape, { reads: {}, moves: true, fields: {} })
    .sections.flatMap((section) => section.strips.flat())
    .find((each) => each.trait === "box" && each.field === field)
  if (control === undefined) throw new Error(field)
  return control
}

function Called({ count, control }: { readonly count: number; readonly control: PanelControl }) {
  return (
    <>
      {Array.from({ length: count }, (_, at) => (
        <Fragment key={at}>{ControlView({ control, palette, onChange: () => undefined })}</Fragment>
      ))}
    </>
  )
}

it("shows a box field's live value even where a control calls it as a plain function a changing number of times", async () => {
  const store = paintStore()
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root: Root = createRoot(host)
  const x = boxField("x")
  const paint = (count: number) =>
    act(async () => {
      root.render(
        <LiveBoxFields store={store} nodes={[node]}>
          <Called count={count} control={x} />
        </LiveBoxFields>,
      )
    })
  await paint(1)
  await paint(2)
  const fields = () =>
    [...host.querySelectorAll<HTMLInputElement>(`input[aria-label="${boxCopy.x}"]`)].map((input) => input.value)
  const before = fields()
  expect(before).toHaveLength(2)
  await act(async () => {
    store.placeBox(node, { x: 914_400, y: 0, cx: 914_400, cy: 914_400 })
  })
  expect(fields()).toHaveLength(2)
  expect(fields()).not.toEqual(before)
  await paint(1)
  expect(fields()).toHaveLength(1)
  await act(async () => root.unmount())
  host.remove()
})
