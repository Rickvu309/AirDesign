import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditorGrid } from "@/editor/editor-grid"
import type { SlideStrip } from "@/editor/slide-sidebar"

const strip: SlideStrip = {
  count: 5,
  current: 3,
  sections: [
    { name: "Opening", start: 0, key: "f0" },
    { name: "Results", start: 2, key: "f1" },
  ],
  onSelect: () => undefined,
  gridStarts: [0, 2],
  thumbHeight: 101,
  thumb: (index) => <span data-painted={index} />,
}

function grid(over: Partial<SlideStrip> = {}): string {
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

function entries(html: string): string[] {
  return [...html.matchAll(/data-slide-entry="(\d+)"/g)].map((found) => found[1] ?? "")
}

describe("grid sections", () => {
  it("names each slide group for a screen reader and draws no heading", () => {
    const html = grid()
    expect(html).toContain('role="group" aria-label="Opening"')
    expect(html).toContain('role="group" aria-label="Results"')
    expect(html).not.toContain("data-section-head")
    expect(html).not.toContain("data-group-rule")
    expect(entries(html)).toEqual(["1", "2", "3", "4", "5"])
  })

  it("shows every slide of a named group, including one the filmstrip has collapsed", () => {
    const html = grid()
    expect(entries(html)).toEqual(["1", "2", "3", "4", "5"])
    const groups = [...html.matchAll(/<div[^>]*data-slide-group="\d+"[^>]*>/g)].map((found) => found[0])
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) expect(group).not.toContain("aria-expanded")
  })

  it("leaves a slide group without a name unlabeled", () => {
    const sections = [
      { name: "Opening", start: 0, key: "f0" },
      { name: null, start: 2, key: "n3" },
      { name: "Results", start: 3, key: "f1" },
    ]
    const html = grid({ sections, gridStarts: [0, 2, 3] })
    expect(html).toContain('role="group" aria-label="Opening"')
    expect(html).toContain('role="group" aria-label="Results"')
    const groups = [...html.matchAll(/<div[^>]*data-slide-group="(\d+)"[^>]*>/g)].map((found) => found[0])
    expect(groups).toHaveLength(3)
    expect(groups[1]).not.toContain("aria-label")
    expect(entries(html)).toEqual(["1", "2", "3", "4", "5"])
  })
})
