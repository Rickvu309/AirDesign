import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { agentDeck, build, lastChild } from "./agent-fixtures.js"
import { ids } from "./sample-deck.js"
import { get } from "./doom-walk.js"

const slide = ids.slide
const text = (more: Record<string, unknown> = {}): AgentChange =>
  ({ op: "add", kind: "text", slide, text: "Margin held", ...more }) as AgentChange

describe("an agent's text grows with its words, as Figma's auto height", () => {
  it("keeps an explicit box's place and width, and lets its height follow the words, as Figma's auto height", () => {
    const doom = build(agentDeck(), text({ box: { x: 10, y: 20, w: 300, h: 80 } }))
    const made = lastChild(doom, slide)
    expect(get(made, "box")).toMatchObject({ x: 10, y: 20, w: 300, rotation: 0 })
    expect(get(made, "text")?.resize).toBe("height")
  })

  it("grows a boxed text past the height the agent guessed when its words need more lines", () => {
    const words =
      "Cutting DSO by 12 days is the clearest cash lever; we ask the board to endorse all three Q4 priorities"
    const doom = build(agentDeck(), text({ textStyle: "title", text: words, box: { x: 120, y: 70, w: 900, h: 160 } }))
    expect(get(lastChild(doom, slide), "box")!.h).toBeGreaterThan(160)
  })

  it("keeps a shape's label fixed to the shape, as Figma does", () => {
    const doom = build(agentDeck(), {
      op: "add",
      kind: "shape",
      slide,
      text: "Label",
      box: { x: 10, y: 20, w: 300, h: 80 },
    } as AgentChange)
    const made = lastChild(doom, slide)
    expect(get(made, "box")).toMatchObject({ w: 300, h: 80 })
    expect(get(made, "text")?.resize).toBe("fixed")
  })
})
