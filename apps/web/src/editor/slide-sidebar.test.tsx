import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"

const strip: SlideStrip = {
  count: 4,
  current: 2,
  sections: [
    { name: "Opening", start: 0 },
    { name: "Results", start: 2 },
  ],
  onSelect: () => undefined,
  thumbHeight: 101,
  thumb: () => null,
}

function markup(over: Partial<SlideStrip> = {}): string {
  return renderToStaticMarkup(<SlideSidebar run="done" title="Deck" strip={{ ...strip, ...over }} />)
}

function tags(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((found) => found[0])
}

describe("slide list", () => {
  it("is one named group, and each slide says its number and how many there are", () => {
    const html = markup()
    expect(html).toContain('role="group" aria-label="Slides"')
    const entries = tags(html, /<button[^>]*data-slide-entry="\d"[^>]*>/g)
    expect(entries.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual([
      "Slide 1 of 4",
      "Slide 2 of 4",
      "Slide 3 of 4",
      "Slide 4 of 4",
    ])
  })

  it("is one tab stop: only the current slide takes Tab, and the sections and other slides wait for the arrows", () => {
    const html = markup()
    const stops = tags(html, /<button[^>]*data-(?:slide-entry|section-head)[^>]*>/g)
    const reachable = stops.filter((tag) => tag.includes('tabindex="0"'))
    expect(reachable).toHaveLength(1)
    expect(reachable[0]).toContain('data-slide-entry="3"')
    expect(stops.filter((tag) => tag.includes('tabindex="-1"'))).toHaveLength(stops.length - 1)
  })

  it("keeps the one tab stop on the current slide when the deck has a single section", () => {
    const html = markup({ current: 0, sections: [{ name: "Opening", start: 0 }] })
    const reachable = tags(html, /<button[^>]*data-(?:slide-entry|section-head)[^>]*>/g).filter((tag) =>
      tag.includes('tabindex="0"'),
    )
    expect(reachable).toHaveLength(1)
    expect(reachable[0]).toContain('data-slide-entry="1"')
  })

  it("tells a screen reader a section's name, its state and, when collapsed, its slides", () => {
    const html = markup()
    const heads = tags(html, /<button[^>]*data-section-head[^>]*>/g)
    expect(heads.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual(["Opening", "Results"])
    expect(heads.every((tag) => tag.includes('aria-expanded="true"'))).toBe(true)
  })

  it("keeps a polite status region ready to announce what a slide command did", () => {
    expect(markup()).toContain('role="status" aria-live="polite"')
  })
})
