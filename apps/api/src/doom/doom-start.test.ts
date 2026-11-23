import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { startEdit, startIds } from "./doom-start.js"

const written = (node: doom.NodeId, prop: string) =>
  startEdit().writes.find((write) => write.node === node && write.prop === prop)?.value as never

describe("a new deck's title slide", () => {
  const theme = written(startIds.deck, "theme") as doom.Theme
  const text = written(startIds.title, "text") as doom.Text
  const box = written(startIds.title, "box") as doom.Box

  it("sets the title in the theme's title style, resting on the slide's middle line", () => {
    expect(text.style).toBe("title")
    expect(text.alignV).toBe("bottom")
    expect(box.y + box.h).toBe(540)
  })

  it("puts the subtitle placeholder under the title with a gap, lighter than the title", () => {
    const subtitle = written(startIds.subtitle, "text") as doom.Text
    const under = written(startIds.subtitle, "box") as doom.Box
    expect(written(startIds.subtitle, "role")).toBe("subtitle")
    expect(subtitle.chars).toBe(doom.placeholderSubtitle)
    expect(under.y - (box.y + box.h)).toBeGreaterThanOrEqual(32)
    expect(theme.textStyles[subtitle.style].weight).toBeLessThan(theme.textStyles[text.style].weight)
  })

  it("takes the slide type scale for its text styles, so a person's Text tool and the agent's patterns share it", () => {
    expect(theme.textStyles).toEqual(doom.slideTextStyles)
    for (const style of Object.values(theme.textStyles)) expect(style.size).toBeGreaterThanOrEqual(36)
    expect(theme.textStyles.title.size).toBe(88)
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
    const compiled = doom.compileAgentEdit(
      started,
      [{ op: "add", kind: "text", slide: startIds.slide, text: "Q3 board update", textStyle: "title" }],
      { author, once: "fill", mint: () => doom.nodeId(`a:${(count += 1)}`) },
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
      style: "title",
    })
  })
})
