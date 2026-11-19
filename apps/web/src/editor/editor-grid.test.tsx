import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditorGrid } from "@/editor/editor-grid"
import type { SlideStrip } from "@/editor/slide-sidebar"

const strip: SlideStrip = {
  count: 4,
  current: 2,
  groups: [
    { name: "Opening", start: 0, key: "f0" },
    { name: "Results", start: 2, key: "f1" },
  ],
  onSelect: () => undefined,
  onAdd: () => undefined,
  onClone: () => undefined,
  onRemove: () => undefined,
  onMove: () => undefined,
  gridStarts: [0, 2],
  thumbHeight: 101,
  thumb: (index) => <span data-painted={index} />,
}

function grid(over: Partial<SlideStrip> = {}): string {
  return renderToStaticMarkup(
    <EditorGrid
      title="Q3 update"
      strip={{ ...strip, ...over }}
      onSlides={() => undefined}
      onExport={() => undefined}
    />,
  )
}

function tags(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((found) => found[0])
}

describe("slide grid", () => {
  it("names every slide, keeps one tab stop on the current slide, and groups a deck by its slide groups", () => {
    const html = grid()
    expect(html).toContain('data-editor-grid="true"')
    expect(html).toContain('role="group" aria-label="Slides"')
    expect(html).toContain('aria-label="Opening"')
    expect(html).toContain('aria-label="Results"')
    expect(html).not.toContain("data-group-head")
    expect(html).not.toContain("data-group-rule")
    expect(html).toContain('aria-label="Grid"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Slides"')
    expect(html).toContain(">New slide<")
    const entries = tags(html, /<button[^>]*data-slide-entry="\d"[^>]*>/g)
    expect(entries.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual([
      "Slide 1 of 4",
      "Slide 2 of 4",
      "Slide 3 of 4",
      "Slide 4 of 4",
    ])
    const current = entries.filter((tag) => tag.includes('aria-current="true"'))
    expect(current).toHaveLength(1)
    expect(current[0]).toContain('data-slide-entry="3"')
    expect(current[0]).toContain('tabindex="0"')
    expect(entries.filter((tag) => tag.includes('tabindex="-1"'))).toHaveLength(3)
  })

  it("names no section a deck does not have", () => {
    const html = grid({ groups: undefined })
    expect(html).not.toContain(">Opening<")
    expect(html).not.toContain(">Results<")
    expect(tags(html, /<button[^>]*data-slide-entry="\d"[^>]*>/g)).toHaveLength(4)
  })

  it("mounts a hundred thumbs and paints none of them up front", () => {
    const html = grid({
      count: 100,
      current: 0,
      groups: undefined,
      thumb: (index) => <span data-painted={index} />,
    })
    expect(html.match(/data-slide-thumb/g)).toHaveLength(100)
    expect(html).not.toContain("data-painted")
    expect(html).toContain('data-slide-list="true"')
  })

  it("announces a slide group by name and draws no count", () => {
    const html = grid()
    expect(html).toContain('aria-label="Opening"')
    expect(html).toContain('aria-label="Results"')
    expect(html).not.toContain("2 slides")
    expect(html).not.toContain("data-group-head")
  })

  it("keeps each slide number separate from its slide button", () => {
    const html = grid()
    const entries = tags(html, /<button[^>]*data-slide-entry="\d"[^>]*>[\s\S]*?<\/button>/g)
    expect(entries).toHaveLength(4)
    for (const entry of entries) expect(entry).not.toMatch(/>\d<\/span>/)
    expect(html.match(/data-slide-number/g)).toHaveLength(4)
  })

  it("carries the slide view's bar: the zoom percent, then Present, then Export", () => {
    const html = renderToStaticMarkup(
      <EditorGrid
        title="Q3 update"
        strip={strip}
        size={{ width: 12_192_000, height: 6_858_000 }}
        onSlides={() => undefined}
        onExport={() => undefined}
      />,
    )
    const bar = tags(html, /<div[^>]*data-view-bar[^>]*>[\s\S]*?Export<\/button>/g)[0] ?? ""
    expect(bar.indexOf("data-zoom-readout")).toBeGreaterThan(-1)
    expect(bar.indexOf("data-zoom-readout")).toBeLessThan(bar.indexOf("data-present-button"))
    expect(bar).toMatch(/data-zoom-readout[^>]*>25%/)
    expect(html).not.toContain('role="slider"')
  })

  it("offers to add a slide after each one", () => {
    const html = grid()
    expect(html).toContain('aria-label="Add slide after slide 1"')
    expect(html).toContain('aria-label="Add slide after slide 4"')
  })
})
