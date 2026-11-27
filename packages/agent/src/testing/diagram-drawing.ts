import * as doom from "@airdesign/doom"
import { guide } from "@airdesign/taste"
import { expect } from "vitest"

import { callTool, type DeckHost, type Session } from "../index.js"
import { memoryDecks } from "./memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

export type Point = { readonly x: number; readonly y: number }
export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Answer = Record<string, any>

export const styles = ["neutral", "consulting", "editorial", "midnight", "technical"] as const
const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

function agent() {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ok: result.ok, fields: result.fields as Answer }
  }
  return { call, fold: (deck: string) => decks.decks.get(deck as never)! }
}

export const recipe = (name: string): string => {
  const blocks = [...(guide(`diagrams/${name}`)?.markdown ?? "").matchAll(/```js\n([\s\S]*?)```/g)]
  expect(blocks, name).toHaveLength(1)
  return blocks[0]![1]!
}

const extent = (lines: readonly string[], name: string) => {
  const first = lines.findIndex((line) => line.startsWith(`const ${name} = `))
  expect(first, name).toBeGreaterThanOrEqual(0)
  const after = lines.findIndex((line, at) => at > first && /^\S/.test(line) && !/^[\])}]/.test(line))
  return { first, after }
}

const given = (script: string, name: string, value: unknown) => {
  const lines = script.split("\n")
  const { first, after } = extent(lines, name)
  return [...lines.slice(0, first), `const ${name} = ${JSON.stringify(value)}`, ...lines.slice(after)].join("\n")
}

export const sample = (name: string, value: string): any => {
  const lines = recipe(name).split("\n")
  const { first, after } = extent(lines, value)
  const code = lines.slice(first, after).join("\n").slice(`const ${value} = `.length)
  return new Function(`return (${code})`)()
}

export const withData = (name: string, data: Readonly<Record<string, unknown>>) =>
  Object.entries(data).reduce((script, [field, value]) => given(script, field, value), recipe(name))

export type Layer = {
  readonly id: string
  readonly name: string
  readonly box: Rect
  readonly fill: string
  readonly stroke: string
  readonly color: string
  readonly text: string
}
export type Line = Layer & { readonly from: string; readonly to: string; readonly points: readonly Point[] }

const paintOf = (paints: readonly doom.Paint[] | undefined) =>
  paints?.map((paint) => (paint.kind === "solid" ? JSON.stringify(paint.color) : paint.kind)).join(" ") ?? ""

export function picture(fold: doom.Doom, frame: doom.NodeId) {
  const slide = doom.slideOf(fold, frame)!
  const placed: { readonly node: doom.Resolved; readonly x: number; readonly y: number }[] = []
  const walk = (node: doom.Resolved, x: number, y: number): void => {
    if (node.id !== frame) placed.push({ node, x, y })
    for (const kid of node.children) walk(kid, x + node.box.x, y + node.box.y)
  }
  const top = flat(doom.resolveSlide(fold, slide, estimate)).find((each) => each.id === frame)!
  walk(top, 0, 0)
  const layers = placed.flatMap(({ node, x, y }): Layer[] => {
    const stored = fold.nodes.get(node.id as doom.NodeId)!
    if (stored.type === "frame") return []
    const text = doom.propOf(stored, "text")
    return [
      {
        id: node.id,
        name: doom.propOf(stored, "name") ?? "",
        box: { x: x + node.box.x, y: y + node.box.y, w: node.box.w, h: node.box.h },
        fill: paintOf(doom.propOf(stored, "fills")),
        stroke: paintOf(doom.propOf(stored, "strokes")),
        color: JSON.stringify(text?.spans[0]?.color ?? ""),
        text: text?.chars ?? "",
      },
    ]
  })
  const lines = layers.flatMap((layer): Line[] => {
    const geometry = doom.propOf(fold.nodes.get(layer.id as doom.NodeId), "geometry")
    if (geometry?.kind !== "line") return []
    const { node, x, y } = placed.find((each) => each.node.id === layer.id)!
    const points = (node.geometry as { points: readonly Point[] }).points
    const from = "node" in geometry.start ? geometry.start.node : ""
    const to = "node" in geometry.end ? geometry.end.node : ""
    const at = { x: x + node.box.x, y: y + node.box.y }
    return [{ ...layer, from, to, points: points.map((p) => ({ x: at.x + p.x, y: at.y + p.y })) }]
  })
  const named = (name: string) => {
    const found = layers.filter((layer) => layer.name === name)
    expect(found, name).toHaveLength(1)
    return found[0]!
  }
  return { layers, lines, named }
}

const flat = (all: readonly doom.Resolved[]): readonly doom.Resolved[] =>
  all.flatMap((each) => [each, ...flat(each.children)])

async function drawn(style: string, script: string) {
  const by = agent()
  const created = await by.call("execute", { script: `createDeck({ style: "${style}" })` })
  expect(created.ok, JSON.stringify(created.fields)).toBe(true)
  const { deck, slides } = created.fields as { deck: string; slides: string[] }
  const answer = await by.call("execute", { deck, script: given(script, "slide", slides[0]) })
  const fold = by.fold(deck)
  const frame = doom.childrenOf(fold, slides[0] as doom.NodeId).at(-1)?.id
  return { answer, fold, frame: frame! }
}

export async function clean(style: string, script: string) {
  const { answer, fold, frame } = await drawn(style, script)
  expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
  expect(answer.fields.problems, `${style} ${JSON.stringify(answer.fields.problems)}`).toEqual([])
  return picture(fold, frame)
}

export async function refused(script: string) {
  const { answer } = await drawn("neutral", script)
  expect(answer.ok).toBe(false)
  return JSON.stringify(answer.fields)
}

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
export const segments = (points: readonly Point[]) => points.slice(1).map((point, at) => [points[at]!, point] as const)
const cuts = ([a, b]: readonly [Point, Point], box: Rect) =>
  overlaps(
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) || 0.01, h: Math.abs(a.y - b.y) || 0.01 },
    { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: box.h - 2 },
  )
export function shared(one: readonly [Point, Point], two: readonly [Point, Point]): number {
  const level = (s: readonly [Point, Point]) => s[0].y === s[1].y
  if (level(one) !== level(two)) return 0
  const [axis, other] = level(one) ? (["x", "y"] as const) : (["y", "x"] as const)
  if (Math.abs(one[0][other] - two[0][other]) > 1) return 0
  const span = (s: readonly [Point, Point]) => [Math.min(s[0][axis], s[1][axis]), Math.max(s[0][axis], s[1][axis])]
  const [a, b] = span(one)
  const [c, d] = span(two)
  return Math.max(0, Math.min(b!, d!) - Math.max(a!, c!))
}
export const near = (a: number, b: number) => Math.abs(a - b) <= 1
const touches = (point: Point, box: Rect) =>
  point.x >= box.x - 1 && point.x <= box.x + box.w + 1 && point.y >= box.y - 1 && point.y <= box.y + box.h + 1

export function wellJoined(boxes: readonly Layer[], lines: readonly Line[]) {
  const byId = new Map(boxes.map((box) => [box.id, box]))
  for (const line of lines) {
    const from = byId.get(line.from)
    const to = byId.get(line.to)
    expect(from, `${line.name} starts on a box`).toBeDefined()
    expect(to, `${line.name} ends on a box`).toBeDefined()
    expect(touches(line.points[0]!, from!.box), `${line.name} leaves ${from!.name}`).toBe(true)
    expect(touches(line.points.at(-1)!, to!.box), `${line.name} reaches ${to!.name}`).toBe(true)
    for (const box of boxes)
      if (box.id !== line.from && box.id !== line.to)
        for (const segment of segments(line.points))
          expect(cuts(segment, box.box), `${line.name} crosses ${box.name}`).toBe(false)
  }
  for (const [at, one] of boxes.entries())
    for (const two of boxes.slice(at + 1)) expect(overlaps(one.box, two.box), `${one.name} on ${two.name}`).toBe(false)
}

export type Drawing = ReturnType<typeof picture>
