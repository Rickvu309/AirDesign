import { describe, expect, it } from "vitest"
import { build, startedDeck, minter, runName } from "./agent-fixtures.js"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { compileAgentChange } from "./agent-compile.js"
import { gapFor } from "./agent-place.js"
import { footerTop } from "./slide-footer.js"
import { type Box, childrenOf, propOf, slidesOf } from "./doom-walk.js"
import type { Doom, NodeId } from "./index.js"
import { layoutFindings } from "./layout-findings.js"
import { agent } from "./sample-deck.js"
import { measure } from "./testing/doom-fixtures-art.js"

const slideOf = (doom: Doom) => slidesOf(doom)[0]!.id
const boxOfRole = (doom: Doom, role: string): Box =>
  propOf(
    childrenOf(doom, slideOf(doom)).find((node) => propOf(node, "role") === role),
    "box",
  )!
const shape = (slide: NodeId): AgentChange => ({ op: "add", kind: "shape", slide })
const clear = gapFor(1920)

function oneByOne(before: Doom, count: number): Doom {
  const mint = minter("p")
  let doom = before
  for (let made = 0; made < count; made += 1) doom = build(doom, shape(slideOf(doom)), mint)
  return doom
}

function inOneBatch(before: Doom, count: number): Doom {
  const edit = compileAgentEdit(
    before,
    Array.from({ length: count }, () => shape(slideOf(before))),
    {
      author: agent(runName),
      once: "batch",
      mint: minter("p"),
    },
  )
  if ("refused" in edit) throw new Error(JSON.stringify(edit))
  return edit.after
}

const added = (doom: Doom): readonly Box[] =>
  childrenOf(doom, slideOf(doom))
    .filter((node) => node.id.startsWith("p:"))
    .map((node) => propOf(node, "box")!)

const apart = (one: Box, two: Box) =>
  one.x + one.w + clear <= two.x ||
  two.x + two.w + clear <= one.x ||
  one.y + one.h + clear <= two.y ||
  two.y + two.h + clear <= one.y

describe.each([
  ["cover", "title", "subtitle"],
  ["titled slide", "titleOnly", "title"],
] as const)("an agent's shapes with no box on a %s", (_, start, above) => {
  describe.each([
    ["one by one", oneByOne],
    ["in one batch", inOneBatch],
  ] as const)("added %s", (__, add) => {
    it.each([1, 3, 6])("share the band above the footer, %i of them", (count) => {
      const doom = add(startedDeck(1, start), count)
      const boxes = added(doom)
      expect(boxes).toHaveLength(count)
      const top = boxOfRole(doom, above)
      const title = boxOfRole(doom, "title")
      for (const box of boxes) {
        expect(box.y).toBeGreaterThanOrEqual(top.y + top.h + clear)
        expect(box.y + box.h).toBeLessThanOrEqual(footerTop(1080))
        expect(box.x).toBeGreaterThanOrEqual(title.x)
        expect(box.x + box.w).toBeLessThanOrEqual(title.x + title.w)
        expect(box.w).toBeGreaterThan(0)
        expect(box.h).toBeGreaterThan(0)
      }
      for (const [at, box] of boxes.entries())
        for (const other of boxes.slice(at + 1)) expect(apart(box, other)).toBe(true)
      expect(layoutFindings(doom, [slideOf(doom)], measure)).toEqual([])
    })
  })

  it("lands the same boxes one by one as in one batch", () => {
    expect(added(inOneBatch(startedDeck(1, start), 6))).toEqual(added(oneByOne(startedDeck(1, start), 6)))
  })

  it("fills the band in reading order", () => {
    const boxes = added(oneByOne(startedDeck(1, start), 6))
    expect(boxes[1]!.y).toBe(boxes[0]!.y)
    expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x)
    expect(boxes[3]!.x).toBe(boxes[0]!.x)
    expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y)
  })

  it("refuses the next one only when the band is full, and says it needs a box", () => {
    const full = oneByOne(startedDeck(1, start), 6)
    expect(compileAgentChange(full, shape(slideOf(full)), minter("x"), {})).toMatchObject({
      refused: "limit",
      field: "box",
      fault: "needs",
      needs: expect.stringMatching(/box/),
    })
  })
})

describe("an agent's shape with no box beside a narrow title", () => {
  it("takes the slide's free room when the title is too narrow for three slots", () => {
    const before = startedDeck(1, "title")
    const slide = slideOf(before)
    const title = childrenOf(before, slide).find((node) => propOf(node, "role") === "title")!.id
    const narrow = build(before, {
      op: "set",
      target: title,
      text: "Q1",
      size: 24,
      box: { x: 160, y: 300, w: 50, h: 40 },
    })
    const doom = build(narrow, shape(slide), minter("p"))
    const [box] = added(doom)
    expect(box!.w).toBeGreaterThan(0)
    expect(box!.h).toBeGreaterThan(0)
    expect(box!.y + box!.h).toBeLessThanOrEqual(footerTop(1080))
  })
})

describe("an agent's shape with no box inside a frame", () => {
  it("fills the frame's free room, however small the frame", () => {
    const mint = minter("p")
    const before = startedDeck(1, "title")
    const slide = slideOf(before)
    const framed = build(before, { op: "add", kind: "frame", slide, box: { x: 200, y: 700, w: 50, h: 20 } }, mint)
    const frame = childrenOf(framed, slide).find((node) => node.type === "frame")!.id
    const doom = build(framed, { op: "add", kind: "shape", slide, into: frame }, mint)
    const inside = childrenOf(doom, frame).map((node) => propOf(node, "box")!)
    expect(inside).toHaveLength(1)
    const box = inside[0]!
    expect(box.w).toBeGreaterThan(0)
    expect(box.h).toBeGreaterThan(0)
    expect(box.x + box.w).toBeLessThanOrEqual(50)
    expect(box.y + box.h).toBeLessThanOrEqual(20)
  })
})
