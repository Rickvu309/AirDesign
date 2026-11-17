import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GridSectionHead } from "./grid-section"
import { EditorGrid } from "@/editor/editor-grid"
import type { SlideStrip } from "@/editor/slide-sidebar"

const strip: SlideStrip = {
  count: 5,
  current: 3,
  sections: [
    { name: "Opening", start: 0 },
    { name: "Results", start: 2 },
  ],
  onSelect: () => undefined,
  thumbHeight: 101,
  thumb: (index) => <span data-painted={index} />,
}

function grid(kept: string | null, over: Partial<SlideStrip> = {}): string {
  const held = new Map<string, string>(kept === null ? [] : [["airdesign.collapsed-sections.deck", kept]])
  vi.stubGlobal("localStorage", { getItem: (key: string) => held.get(key) ?? null, setItem: () => undefined })
  return renderToStaticMarkup(
    <EditorGrid
      id="deck"
      title="Q3 update"
      strip={{ ...strip, ...over }}
      onSlides={() => undefined}
      onExport={() => undefined}
    />,
  )
}

function heads(html: string): string[] {
  return [...html.matchAll(/<button[^>]*data-section-head[^>]*>/g)].map((found) => found[0])
}

function entries(html: string): string[] {
  return [...html.matchAll(/data-slide-entry="(\d+)"/g)].map((found) => found[1] ?? "")
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("grid sections", () => {
  it("gives each section a heading button that says its size and whether it is open", () => {
    const html = grid(null)
    const [opening, results] = heads(html)
    expect(opening).toContain('aria-expanded="true"')
    expect(results).toContain('aria-expanded="true"')
    expect(html).toMatch(/<h2[^>]*><button[^>]*aria-expanded="true"[^>]*>.*Opening.*2 slides.*<\/button><\/h2>/)
    expect(entries(html)).toEqual(["1", "2", "3", "4", "5"])
  })

  it("shows a section the deck kept collapsed as its heading alone, and keeps the current slide's section open", () => {
    const html = grid("[0,1]")
    const [opening, results] = heads(html)
    expect(opening).toContain('aria-expanded="false"')
    expect(results).toContain('aria-expanded="true"')
    expect(entries(html)).toEqual(["3", "4", "5"])
    expect(html).toContain('data-slide-entry="4"')
    expect(html).toMatch(/data-slide-entry="4"[^>]*>|tabindex="0"[^>]*data-slide-entry="4"/)
  })
})

it("keeps overview section names on one line with a full accessible and pointer name", () => {
  const html = renderToStaticMarkup(
    <GridSectionHead marker name="Introduction" count={12} open onToggle={() => undefined} />,
  )
  expect(html).toContain('title="Introduction"')
  expect(html).toContain('aria-label="Introduction')
  expect(html).not.toContain("wrap-anywhere")
  expect(html).toContain("truncate")
})
