import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { startEdit, startIds } from "./scene-start.js"

const written = (node: scene.NodeId, prop: string) =>
  startEdit().writes.find((write) => write.node === node && write.prop === prop)?.value as never

describe("a new deck's title slide", () => {
  const theme = written(startIds.deck, "theme") as scene.Theme
  const text = written(startIds.title, "text") as scene.Text
  const box = written(startIds.title, "box") as scene.Box

  it("sets the title in the theme's largest style, resting on the slide's middle line", () => {
    expect(text.style).toBe("bigNumber")
    expect(text.alignV).toBe("bottom")
    expect(theme.textStyles.bigNumber.size).toBeGreaterThan(theme.textStyles.title.size)
    expect(box.y + box.h).toBe(540)
  })

  it("takes the slide type scale for its text styles, so a person's Text tool and the agent's patterns share it", () => {
    expect(theme.textStyles).toEqual(scene.slideTextStyles)
    for (const style of Object.values(theme.textStyles)) expect(style.size).toBeGreaterThanOrEqual(36)
    expect(theme.textStyles.title.size).toBe(88)
  })
})

describe("an agent's title on a new deck's first slide", () => {
  it("replaces the Untitled placeholder and adds no second title", () => {
    const author = { kind: "agent", id: "aira", run: "r" } as const
    const opened = scene.applyEdit(scene.emptyScene, { ...startEdit(), rev: scene.rev(1) })
    if (scene.isRefusal(opened)) throw new Error(JSON.stringify(opened))
    const started = scene.applyEdit(opened, { once: "begin", author, writes: [], phase: "start", rev: scene.rev(2) })
    if (scene.isRefusal(started)) throw new Error(JSON.stringify(started))
    let count = 0
    const compiled = scene.compileAgentEdit(
      started,
      [{ op: "add", kind: "text", slide: startIds.slide, text: "Q3 board update", textStyle: "title" }],
      { author, once: "fill", mint: () => scene.nodeId(`a:${(count += 1)}`) },
    )
    if ("refused" in compiled) throw new Error(JSON.stringify(compiled))
    const landed = scene.applyEdit(started, { ...compiled.edit, rev: scene.rev(3) })
    if (scene.isRefusal(landed)) throw new Error(JSON.stringify(landed))
    const onSlide = [...landed.nodes.values()].filter(
      (node) => (node as { parent?: { id: string } }).parent?.id === startIds.slide,
    )
    expect(onSlide).toHaveLength(1)
    expect((landed.nodes.get(startIds.title) as { text?: scene.Text }).text).toMatchObject({
      chars: "Q3 board update",
      style: "bigNumber",
    })
  })
})
