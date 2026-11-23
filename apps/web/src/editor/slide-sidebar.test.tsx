import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { slideChangeAllowed } from "@/editor/slide-menu"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"

const strip: SlideStrip = {
  count: 4,
  current: 2,
  groups: [
    { name: "Opening", start: 0, key: "f0" },
    { name: "Results", start: 2, key: "f1" },
  ],
  onSelect: () => undefined,
  thumbHeight: 101,
  thumb: () => null,
}

function markup(over: Partial<SlideStrip> = {}): string {
  return renderToStaticMarkup(<SlideSidebar title="Deck" strip={{ ...strip, ...over }} />)
}

function tags(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((found) => found[0])
}

describe("slide list", () => {
  it("enables Add slide once the deck's first slide has painted", () => {
    const onAdd = () => undefined
    const add = (html: string) => tags(html, /<button[^>]*aria-label="Add slide"[^>]*>/g)[0]
    expect(add(markup({ count: 0, groups: [], onAdd }))).toMatch(/ disabled(?:=|[ >])/)
    expect(add(markup({ onAdd }))).not.toMatch(/ disabled(?:=|[ >])/)
  })

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

  it("is one tab stop: only the current slide takes Tab, and the slide groups and other slides wait for the arrows", () => {
    const html = markup()
    const stops = tags(html, /<button[^>]*data-(?:slide-entry|group-head)[^>]*>/g)
    const reachable = stops.filter((tag) => tag.includes('tabindex="0"'))
    expect(reachable).toHaveLength(1)
    expect(reachable[0]).toContain('data-slide-entry="3"')
    expect(stops.filter((tag) => tag.includes('tabindex="-1"'))).toHaveLength(stops.length - 1)
  })

  it("keeps the one tab stop on the current slide when the deck has a single section", () => {
    const html = markup({ current: 0, groups: [{ name: "Opening", start: 0, key: "f0" }] })
    const reachable = tags(html, /<button[^>]*data-(?:slide-entry|group-head)[^>]*>/g).filter((tag) =>
      tag.includes('tabindex="0"'),
    )
    expect(reachable).toHaveLength(1)
    expect(reachable[0]).toContain('data-slide-entry="1"')
  })

  it("tells a screen reader a section's name, its state and, when collapsed, its slides", () => {
    const html = markup()
    const heads = tags(html, /<button[^>]*data-group-head[^>]*>/g)
    expect(heads.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual(["Opening", "Results"])
    expect(heads.every((tag) => tag.includes('aria-expanded="true"'))).toBe(true)
  })

  it("keeps a polite status region ready to announce what a slide command did", () => {
    expect(markup()).toContain('role="status" aria-live="polite"')
  })

  it("paints the current slide number with the index role", () => {
    const html = markup()
    const entry = (number: string) => {
      const start = html.indexOf(`data-slide-entry="${number}"`)
      const next = html.indexOf("data-slide-entry=", start + 1)
      return html.slice(start, next === -1 ? undefined : next)
    }
    expect(entry("3")).toContain("text-index")
    expect(entry("1")).toContain("text-quiet")
    expect(entry("1")).not.toContain("text-index")
  })

  it("has no separate actions button on a slide", () => {
    const html = markup()
    expect(html).not.toContain("data-slide-actions")
    expect(html).not.toMatch(/aria-label="Slide \d+ actions"/)
  })
})

describe("way home", () => {
  it("links the mark to the deck home, named by where it goes", () => {
    const html = markup()
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*aria-label="Go to your decks"[^>]*>\s*<svg/)
  })
})

describe("slide menu", () => {
  it("allows move up after the first slide, move down before the last, and delete only when another slide remains", () => {
    expect(slideChangeAllowed("up", 0, 4)).toBe(false)
    expect(slideChangeAllowed("down", 0, 4)).toBe(true)
    expect(slideChangeAllowed("down", 3, 4)).toBe(false)
    expect(slideChangeAllowed("up", 3, 4)).toBe(true)
    expect(slideChangeAllowed("up", 1, 4)).toBe(true)
    expect(slideChangeAllowed("down", 1, 4)).toBe(true)
    expect(slideChangeAllowed("remove", 0, 1)).toBe(false)
    expect(slideChangeAllowed("remove", 1, 4)).toBe(true)
    expect(slideChangeAllowed("clone", 0, 1)).toBe(true)
  })
})
