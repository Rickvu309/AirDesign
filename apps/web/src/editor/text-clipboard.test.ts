import * as doom from "@airdesign/doom"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { sliceText } from "./text-edit"
import { readTextClipboard, writeTextClipboard } from "./text-clipboard"

let window: Window & typeof globalThis

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  vi.stubGlobal("DOMParser", window.DOMParser)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function clipboard() {
  const data = new Map<string, string>()
  return {
    data,
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  }
}

const slide = (id: string) => id as doom.NodeId

describe("text clipboard", () => {
  it("keeps web and mailto links within a deck and between decks", () => {
    const source = doom.textFromMarkdown("Read [report](https://a.example/q4) or [email](mailto:hi@a.example)", "body")
    const copied = sliceText(source, 5, source.chars.length)
    const bag = clipboard()
    writeTextClipboard(bag, copied, "deck-1")

    expect(bag.getData("text/plain")).toBe("report or email")
    expect(bag.getData("text/html")).toContain('href="https://a.example/q4"')
    expect(bag.getData("text/html")).toContain('href="mailto:hi@a.example"')

    expect(readTextClipboard(bag, { deck: "deck-1", slides: [slide("s:1")] })).toEqual(copied)
    expect(readTextClipboard(bag, { deck: "deck-2", slides: [slide("s:1")] })).toEqual(copied)
  })

  it("keeps a slide link in the same deck when that slide exists, and drops it in another deck or if deleted", () => {
    const source: doom.Text = {
      ...doom.textFromMarkdown("Go to appendix", "body"),
      spans: [{ end: 6 }, { end: 14, bold: true, link: slide("s:2") }],
    }
    const copied = sliceText(source, 0, source.chars.length)
    const bag = clipboard()
    writeTextClipboard(bag, copied, "deck-1")
    expect(bag.getData("text/html")).not.toContain('href="s:2"')

    expect(readTextClipboard(bag, { deck: "deck-1", slides: [slide("s:1"), slide("s:2")] })).toEqual(copied)
    expect(readTextClipboard(bag, { deck: "deck-1", slides: [slide("s:1")] })).toEqual({
      chars: "Go to appendix",
      spans: [{ end: 6 }, { end: 14, bold: true }],
      paras: [{}],
    })
    expect(readTextClipboard(bag, { deck: "deck-2", slides: [slide("s:1"), slide("s:2")] })).toEqual({
      chars: "Go to appendix",
      spans: [{ end: 6 }, { end: 14, bold: true }],
      paras: [{}],
    })
  })

  it("returns null for foreign HTML or an invalid clipboard payload", () => {
    const foreign = clipboard()
    foreign.setData("text/html", '<a href="https://example.com">link</a>')
    expect(readTextClipboard(foreign, { deck: "deck-1", slides: [] })).toBeNull()

    const bad = clipboard()
    bad.setData(
      "text/html",
      `<span data-airdesign-text="${JSON.stringify({
        deck: "deck-1",
        slice: { chars: "hi", spans: [{ end: 2, link: "javascript:alert(1)" }], paras: [{}] },
      }).replace(/"/g, "&quot;")}">hi</span>`,
    )
    expect(readTextClipboard(bad, { deck: "deck-1", slides: [] })).toBeNull()
  })
})
