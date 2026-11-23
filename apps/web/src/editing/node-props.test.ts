import { describe, expect, it } from "vitest"
import { holdsText } from "./node-props"
import { grow, paint, spot } from "@/testing/doom-fixtures"

describe("which layers hold words", () => {
  const built = grow([
    { type: "shape", name: "card", props: { box: spot(100, 100, 300, 200), fills: paint } },
    { type: "frame", name: "group", props: { box: spot(500, 100, 300, 200) } },
    {
      type: "shape",
      name: "star",
      props: { box: spot(900, 100, 100, 100), geometry: { kind: "icon", name: "lucide/star" } },
    },
    {
      type: "shape",
      name: "rule",
      props: {
        geometry: {
          kind: "line",
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          route: "straight",
          arrows: ["none", "none"],
        },
      },
    },
  ])
  const { card, group, rule, star } = built.ids

  it("takes a shape with no words yet, so a double-click or Enter can start them", () => {
    expect(holdsText(built.view, card!)).toBe(true)
  })

  it("leaves out a frame, an icon, a line and a layer that is not there", () => {
    expect(holdsText(built.view, group!)).toBe(false)
    expect(holdsText(built.view, star!)).toBe(false)
    expect(holdsText(built.view, rule!)).toBe(false)
    expect(holdsText(built.view, "missing" as never)).toBe(false)
  })
})
