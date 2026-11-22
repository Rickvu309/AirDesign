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
})
