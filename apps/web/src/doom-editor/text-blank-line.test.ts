import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { grow, paint, spot } from "@/testing/doom-fixtures"
import { blankLine } from "./text-blank-line"

const blank = (alignV: doom.Text["alignV"]): doom.Text => ({ ...doom.textFromMarkdown("", "body"), alignV })

describe("the caret line of an empty text", () => {
  const { geometry, ids } = grow([
    { type: "shape", name: "box", props: { box: spot(0, 0, 400, 200), fills: paint } },
    {
      type: "shape",
      name: "peak",
      props: { box: spot(0, 0, 400, 200), fills: paint, geometry: { kind: "preset", name: "triangle" } },
    },
  ])
  const node = (name: string) => geometry.byId.get(ids[name] as doom.NodeId)!.node
  const line = doom.defaultTheme.textStyles.body.size * doom.defaultTheme.textStyles.body.lineHeight

  it("sits where the first letter will: at the top, the middle or the bottom of the box", () => {
    expect(blankLine(blank("top"), doom.defaultTheme, node("box"))).toMatchObject({ x: 0, y: 0, w: 400 })
    expect(blankLine(blank("center"), doom.defaultTheme, node("box")).y).toBeCloseTo((200 - line) / 2)
    expect(blankLine(blank("bottom"), doom.defaultTheme, node("box")).y).toBeCloseTo(200 - line)
  })

  it("sits in a preset's text area, not its box", () => {
    const caret = blankLine(blank("center"), doom.defaultTheme, node("peak"))
    expect(caret).toMatchObject({ x: 100, w: 200 })
    expect(caret.y).toBeCloseTo(100 + (100 - line) / 2)
  })
})
