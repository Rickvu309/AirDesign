import * as doom from "@airdesign/doom"
import { readSkill, readSkillIndex } from "@airdesign/skills"
import { describe, expect, it } from "vitest"

import { callTool, emptyLog, type DeckHost, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

type Point = { readonly x: number; readonly y: number }
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Answer = Record<string, any>

const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

const layoutOf = (skill: string) => {
  const blocks = [...(readSkill(skill)?.markdown ?? "").matchAll(/```js\n([\s\S]*?)```/g)].map((found) => found[1]!)
  expect(blocks, skill).toHaveLength(2)
  return blocks[1]!
}

async function draw(script: string) {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ok: result.ok, fields: result.fields as Answer }
  }
  const made = await call("execute", { script: "createDeck()" })
  const deck = made.fields.deck as string
  const drawn = await call("execute", { deck, script })
  return { ...drawn, fold: () => decks.decks.get(deck as never)! }
}

const flat = (all: readonly doom.Resolved[]): readonly doom.Resolved[] =>
  all.flatMap((each) => [each, ...flat(each.children)])

function painted(fold: doom.Doom) {
  const slide = doom.slidesOf(fold).at(-1)!.id
  const all = flat(doom.resolveSlide(fold, slide, estimate))
  const lines = all.flatMap((each) => {
    const geometry = each.geometry as { kind: string; points?: readonly Point[] } | null
    if (geometry?.kind !== "line") return []
    const stored = doom.propOf(fold.nodes.get(each.id as doom.NodeId), "geometry") as {
      start: { node?: string }
      end: { node?: string }
    }
    const points = geometry.points!.map((point) => ({ x: each.box.x + point.x, y: each.box.y + point.y }))
    return [{ id: each.id, from: stored.start.node, to: stored.end.node, points }]
  })
  const boxes = new Map(all.map((each) => [each.id, each.box as Rect]))
  return { slide, lines, boxes }
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const segments = (points: readonly Point[]) => points.slice(1).map((point, at) => [points[at]!, point] as const)
const cuts = ([a, b]: readonly [Point, Point], box: Rect) =>
  overlaps(
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) || 0.01, h: Math.abs(a.y - b.y) || 0.01 },
    { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: box.h - 2 },
  )
function shared(one: readonly [Point, Point], two: readonly [Point, Point]): number {
  const level = (s: readonly [Point, Point]) => s[0].y === s[1].y
  if (level(one) !== level(two)) return 0
  const [axis, other] = level(one) ? (["x", "y"] as const) : (["y", "x"] as const)
  if (Math.abs(one[0][other] - two[0][other]) > 1) return 0
  const span = (s: readonly [Point, Point]) => [Math.min(s[0][axis], s[1][axis]), Math.max(s[0][axis], s[1][axis])]
  const [a, b] = span(one)
  const [c, d] = span(two)
  return Math.max(0, Math.min(b!, d!) - Math.max(a!, c!))
}

const edges = [
  ["Browser", "Search"],
  ["Browser", "Catalog"],
  ["Browser", "Checkout"],
  ["Partner API", "Catalog"],
  ["Admin console", "Catalog"],
  ["Catalog", "Products DB"],
  ["Search", "Products DB"],
  ["Checkout", "Orders DB"],
  ["Checkout", "Products DB"],
] as const
const architecture = `
const slide = insert({ kind: "slide" })
const layers = [
  { name: "Clients", boxes: ["Admin console", "Browser", "Partner API"] },
  { name: "Services", boxes: ["Checkout", "Catalog", "Search"] },
  { name: "Data", boxes: ["Products DB", "Orders DB"] },
]
const edges = ${JSON.stringify(edges)}
const path = ["Browser", "Checkout", "Products DB"]
`

describe("the architecture recipe on a new system", () => {
  it("draws 8 boxes in 3 layers and 9 arrows, each attached to its two boxes, none crossing a box or another arrow", async () => {
    const drawn = await draw(`${architecture}\n${layoutOf("diagrams/architecture")}`)
    expect(drawn.ok, JSON.stringify(drawn.fields)).toBe(true)
    expect(drawn.fields.problems).toEqual([])
    const { boxes: ids, problems } = drawn.fields.result as { boxes: Record<string, string>; problems: unknown[] }
    expect(problems).toEqual([])
    expect(Object.keys(ids)).toHaveLength(8)

    const { lines, boxes } = painted(drawn.fold())
    expect(edges).toHaveLength(9)
    expect(lines.map((line) => [line.from, line.to]).sort()).toEqual(edges.map(([a, b]) => [ids[a], ids[b]]).sort())

    const rects = Object.values(ids).map((id) => boxes.get(id)!)
    for (const [at, one] of rects.entries())
      for (const two of rects.slice(at + 1)) expect(overlaps(one, two)).toBe(false)

    for (const line of lines)
      for (const [name, id] of Object.entries(ids))
        if (id !== line.from && id !== line.to)
          for (const segment of segments(line.points))
            expect(cuts(segment, boxes.get(id)!), `${line.id} crosses ${name}`).toBe(false)

    for (const [at, one] of lines.entries())
      for (const two of lines.slice(at + 1))
        for (const a of segments(one.points))
          for (const b of segments(two.points)) {
            const sameEnd = one.from === two.from || one.to === two.to
            expect(sameEnd ? 0 : shared(a, b), `${one.id} runs on ${two.id}`).toBeLessThanOrEqual(1)
          }
  })

  it("stops with a sentence the agent can act on when an arrow would skip a layer", async () => {
    const skipping = architecture.replace(`["Checkout","Orders DB"]`, `["Browser","Orders DB"]`)
    const drawn = await draw(`${skipping}\n${layoutOf("diagrams/architecture")}`)
    expect(drawn.ok).toBe(false)
    expect(JSON.stringify(drawn.fields)).toContain("Browser to Orders DB would cross other boxes")
  })
})

describe("the process flow recipe on new steps", () => {
  it("draws five steps joined in order by arrows attached to both, inside the body area", async () => {
    const drawn = await draw(`
      const slide = insert({ kind: "slide" })
      const steps = [
        { name: "Request", points: ["Form or chat"] },
        { name: "Check", points: ["Order and receipt"] },
        { name: "Approve", points: ["A person, 2 days"] },
        { name: "Inspect", points: ["A person, 3 days"] },
        { name: "Refund", points: ["Back to the card"] },
      ]
      const focus = "Approve"
      ${layoutOf("diagrams/process-flow")}
    `)
    expect(drawn.ok, JSON.stringify(drawn.fields)).toBe(true)
    const { steps, problems } = drawn.fields.result as { steps: string[]; problems: unknown[] }
    expect(problems).toEqual([])
    const { lines, boxes } = painted(drawn.fold())
    expect(lines.map((line) => [line.from, line.to])).toEqual(steps.slice(1).map((step, at) => [steps[at], step]))
    for (const id of steps) {
      const box = boxes.get(id)!
      expect(box.y).toBeGreaterThanOrEqual(300)
      expect(box.x + box.w).toBeLessThanOrEqual(1800)
    }
  })
})

describe("the diagram skills", () => {
  it("are listed in the index and named in the kit guide", () => {
    const names = readSkillIndex().skills.map((skill) => skill.name)
    const kit = readSkill("kit")?.markdown ?? ""
    for (const name of ["diagrams/architecture", "diagrams/process-flow"]) {
      expect(names).toContain(name)
      expect(kit).toContain(`\`${name}\``)
    }
  })
})
