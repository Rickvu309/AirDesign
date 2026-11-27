import * as doom from "@airdesign/doom"
import { compileAgentEdit, placeholderSubtitle } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { startEdit, startIds } from "./doom-start.js"
import { placement } from "@airdesign/doom/testing"

const written = (node: doom.NodeId, prop: string) =>
  startEdit().writes.find((write) => write.node === node && write.prop === prop)?.value as never

describe("a new deck's title slide", () => {
  const theme = written(startIds.deck, "theme") as doom.Theme
  const text = written(startIds.title, "text") as doom.Text
  const box = written(startIds.title, "box") as doom.Box

  it("sets the title in the theme's display style, resting on the slide's middle line", () => {
    expect(text.style).toBe("display")
    expect(text.alignV).toBe("bottom")
    expect(box.y + box.h).toBe(540)
  })

  it("puts the subtitle placeholder under the title with a gap, lighter than the title", () => {
    const subtitle = written(startIds.subtitle, "text") as doom.Text
    const under = written(startIds.subtitle, "box") as doom.Box
    expect(written(startIds.subtitle, "role")).toBe("subtitle")
    expect(subtitle.chars).toBe(placeholderSubtitle)
    expect(under.y - (box.y + box.h)).toBeGreaterThanOrEqual(32)
    expect(theme.textStyles[subtitle.style].weight).toBeLessThan(theme.textStyles[text.style].weight)
  })

  it("takes the slide type scale for its text styles, so a person's Text tool and agent edits share it", () => {
    expect(theme.textStyles).toEqual(doom.defaultTheme.textStyles)
    for (const style of Object.values(theme.textStyles)) expect(style.size).toBeGreaterThanOrEqual(24)
    expect(theme.textStyles.title.size).toBe(56)
  })

  it("takes the default theme's effect styles, so glow is a drop shadow with no offset, never a blur of the layer", () => {
    expect(theme.effectStyles).toEqual(doom.defaultTheme.effectStyles)
  })
})

describe("an agent's title on a new deck's first slide", () => {
  it("replaces the Untitled placeholder and adds no second title", () => {
    const author = { kind: "agent", id: "aira", run: "r" } as const
    const opened = doom.applyEdit(doom.emptyDoom, { ...startEdit(), rev: doom.rev(1) })
    if (doom.isRefusal(opened)) throw new Error(JSON.stringify(opened))
    const started = doom.applyEdit(opened, { once: "begin", author, writes: [], phase: "start", rev: doom.rev(2) })
    if (doom.isRefusal(started)) throw new Error(JSON.stringify(started))
    let count = 0
    const compiled = compileAgentEdit(
      started,
      [{ op: "add", kind: "text", slide: startIds.slide, text: "Q3 board update", textStyle: "title" }],
      { placement, author, once: "fill", mint: () => doom.nodeId(`a:${(count += 1)}`) },
    )
    if ("refused" in compiled) throw new Error(JSON.stringify(compiled))
    const landed = doom.applyEdit(started, { ...compiled.edit, rev: doom.rev(3) })
    if (doom.isRefusal(landed)) throw new Error(JSON.stringify(landed))
    const onSlide = [...landed.nodes.values()].filter(
      (node) => (node as { parent?: { id: string } }).parent?.id === startIds.slide,
    )
    expect(onSlide).toHaveLength(2)
    expect((landed.nodes.get(startIds.title) as { text?: doom.Text }).text).toMatchObject({
      chars: "Q3 board update",
      style: "display",
    })
  })
})
