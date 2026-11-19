import { elementId, slideId } from "@airdesign/document"
import { textFormatting, type TextFormatting } from "@airdesign/render"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { toolbarCopy } from "@/copy/toolbar-copy"
import { EditorToolbar } from "@/editor/editor-toolbar"
import { toneLink, type ToneSource } from "@/editor/tone-link"
import type { ToneControlFor } from "@/editor/adjust-tone"

let window: Window & typeof globalThis

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
    ["Element", window.Element],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

type Target = Parameters<TextFormatting["register"]>[1]

const target: Target = {
  link: () => null,
  linkTo: () => undefined,
  selection: () => false,
  edits: () => true,
  state: () => "off",
  apply: () => undefined,
  size: () => 1800,
  resize: () => undefined,
  sizeTo: () => undefined,
  color: () => null,
  choose: () => undefined,
  align: () => "left",
  place: () => undefined,
  bullet: () => "off",
  bullets: () => undefined,
  swatches: () => [],
}

const toneFor: ToneControlFor = () => ({
  blocked: undefined,
  notice: undefined,
  busy: false,
  choice: undefined,
  resettable: false,
  refresh: () => undefined,
  choose: () => undefined,
  reset: () => undefined,
})

async function toolbar(options: { aimed: boolean; tone: boolean; ready?: boolean }) {
  const formatting = textFormatting()
  const id = elementId("256.4")
  formatting.register(id, target)
  if (options.aimed) formatting.aim(id)
  const link = toneLink()
  if (options.ready !== false) link.publish(toneFor)
  const asked: string[] = []
  const tone: ToneSource = {
    link,
    scope: (node) => {
      asked.push(node)
      return { slide: slideId("256"), selection: [node], text: [node] }
    },
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<EditorToolbar formatting={formatting} {...(options.tone ? { tone } : {})} />))
  const names = () =>
    [...host.querySelectorAll("button[aria-label]")].map((button) => button.getAttribute("aria-label"))
  async function close() {
    await act(async () => root.unmount())
    host.remove()
  }
  return { names, asked, close }
}

it("offers Actions beside the text controls for the layer in hand, scoped to that one layer", async () => {
  const shown = await toolbar({ aimed: true, tone: true })
  expect(shown.names()).toContain(toolbarCopy.actions)
  expect(shown.asked).toEqual(["256.4"])
  await shown.close()
})

it("offers no Actions without a text layer in hand, without Aira's tone control or before Aira has published it", async () => {
  for (const options of [
    { aimed: false, tone: true },
    { aimed: true, tone: false },
    { aimed: true, tone: true, ready: false },
  ]) {
    const shown = await toolbar(options)
    expect(shown.names()).not.toContain(toolbarCopy.actions)
    await shown.close()
  }
})
