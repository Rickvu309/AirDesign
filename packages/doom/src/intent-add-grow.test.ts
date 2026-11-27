import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { agentDeck, build, compiled, lastChild, minter } from "./testing/agent-fixtures.js"
import { agent, ids, tryLand } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"
import { applyEdit, deckOf, isRefusal, measureWith, rev, solveLayout, type Doom, type Landed } from "./index.js"
import { invert } from "./invert.js"

const slide = ids.slide
const text = (more: Record<string, unknown> = {}): Intent =>
  ({ op: "add", kind: "text", slide, text: "Margin held", ...more }) as Intent

describe("an agent's text grows with its words, as Figma's auto height", () => {
  it("keeps an explicit box's place and width, and lets its height follow the words, as Figma's auto height", () => {
    const doom = build(agentDeck(), text({ box: { x: 10, y: 20, w: 300, h: 80 } }))
    const made = lastChild(doom, slide)
    expect(propOf(made, "box")).toMatchObject({ x: 10, y: 20, w: 300, rotation: 0 })
    expect(propOf(made, "text")?.resize).toBe("height")
  })

  it("grows a boxed text past the height the agent guessed when its words need more lines", () => {
    const words =
      "Cutting DSO by 12 days is the clearest cash lever; we ask the board to endorse all three Q4 priorities"
    const doom = build(agentDeck(), text({ textStyle: "title", text: words, box: { x: 120, y: 70, w: 900, h: 160 } }))
    expect(propOf(lastChild(doom, slide), "box")!.h).toBeGreaterThan(160)
  })

  it("keeps a shape's label fixed to the shape, as Figma does", () => {
    const doom = build(agentDeck(), {
      op: "add",
      kind: "shape",
      slide,
      text: "Label",
      box: { x: 10, y: 20, w: 300, h: 80 },
    } as unknown as Intent)
    const made = lastChild(doom, slide)
    expect(propOf(made, "box")).toMatchObject({ w: 300, h: 80 })
    expect(propOf(made, "text")?.resize).toBe("fixed")
  })

  const estimate = measureWith({})
  const words = "Cutting DSO by 12 days is the clearest cash lever; we ask the board to endorse all three Q4 priorities"
  const grown = () =>
    build(agentDeck(), text({ textStyle: "title", text: words, box: { x: 120, y: 70, w: 900, h: 160 } }))

  it("fixes the box once the agent sets its height, as a height dragged by hand does in Figma", () => {
    const before = grown()
    const made = lastChild(before, slide)
    const after = build(before, { op: "set", target: made.id, box: { h: 400 } } as unknown as Intent)
    const set = after.nodes.get(made.id)!
    expect(propOf(set, "text")?.resize).toBe("fixed")
    expect(propOf(set, "box")?.h).toBe(400)
    expect(solveLayout(after, slide, estimate).get(made.id)?.h).toBe(400)
  })

  it("keeps auto height when the agent moves the box and sends back the height it already has", () => {
    const before = grown()
    const made = lastChild(before, slide)
    const { h } = propOf(made, "box")!
    const after = build(before, {
      op: "set",
      target: made.id,
      box: { x: 200, y: 80, w: 900, h },
    } as unknown as Intent)
    expect(propOf(after.nodes.get(made.id)!, "text")?.resize).toBe("height")
  })

  it("keeps auto height when the agent sets only the width", () => {
    const before = grown()
    const made = lastChild(before, slide)
    const after = build(before, { op: "set", target: made.id, box: { w: 1600 } } as unknown as Intent)
    expect(propOf(after.nodes.get(made.id)!, "text")?.resize).toBe("height")
  })

  it("undoes the add whole, and undoes a height set back to auto height", () => {
    const step = (doom: Doom, change: Intent) => {
      const edit: Landed = {
        once: `u-${String(doom.rev)}`,
        author: agent("run-1"),
        writes: compiled(doom, change),
        rev: rev(doom.rev + 1),
      }
      const after = applyEdit(doom, edit)
      if (isRefusal(after)) throw new Error(after.refused)
      return { before: doom, after, edit }
    }
    const added = step(agentDeck(), text({ box: { x: 10, y: 20, w: 300, h: 80 } }))
    const made = lastChild(added.after, slide)
    const gone = (tryLand(added.after, invert(added.before, added.after, added.edit)) as Doom).nodes.get(made.id)
    expect(gone === undefined || propOf(gone, "parent") == null).toBe(true)
    const sized = step(added.after, { op: "set", target: made.id, box: { h: 400 } } as unknown as Intent)
    expect(propOf(sized.after.nodes.get(made.id)!, "text")?.resize).toBe("fixed")
    const undone = tryLand(sized.after, invert(sized.before, sized.after, sized.edit)) as Doom
    expect(propOf(undone.nodes.get(made.id)!, "text")?.resize).toBe("height")
  })

  it("hugs its words in an auto layout frame, whatever height the agent named", () => {
    const framed = build(agentDeck(), {
      op: "add",
      kind: "frame",
      slide,
      layout: "column",
      box: { x: 100, y: 100, w: 800, h: 600 },
    } as unknown as Intent)
    const frame = lastChild(framed, slide)
    const doom = build(framed, text({ into: frame.id, box: { x: 0, y: 0, w: 800, h: 20 } }), minter("b"))
    const made = lastChild(doom, frame.id)
    expect(propOf(made, "text")?.resize).toBe("height")
    expect(solveLayout(doom, slide, estimate).get(made.id)?.h).toBe(
      estimate(propOf(made, "text")!, deckOf(doom).theme, 800).h,
    )
  })
})
