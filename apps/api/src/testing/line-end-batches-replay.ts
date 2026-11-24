import { randomBytes } from "node:crypto"
import * as doom from "@airdesign/doom"

import { createDoom, editDoom, openDoom } from "../doom/doom-deck.js"
import { startIds } from "../doom/doom-start.js"
import type { Sql } from "../platform/pool.js"
import { same, type Graph, type SpecState } from "./spec-graph.js"

const id = doom.nodeId
const x = id("c2:1")
const line = id("c2:2")
const shelf = id("c2:3")
const inner = id("c2:4")
const y = id("c2:5")
const holder = id("c2:6")
const drawn = id("c2:7")
const plain = id("c2:8")
const frame = id("c2:9")
const kept = id("c2:10")
const first = doom.orderKeyBetween(null, null)
const at = (parent: string) => ({ id: parent, at: first })
const placed = (left: number) => ({ x: left, y: 200, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })
const named = { X: x, Y: y } as Readonly<Record<string, doom.NodeId>>

function endOf(name: unknown): doom.End {
  const node = typeof name === "string" ? named[name] : undefined
  return node === undefined ? { x: 20, y: 20 } : { node, site: "r" }
}

const lineOf = (start: doom.End) => ({
  kind: "line" as const,
  start,
  end: { x: 10, y: 10 },
  route: "straight" as const,
  arrows: ["none", "none"] as const,
})

const made = (node: doom.NodeId, type: string, parent: string): doom.Write[] => [
  { node, prop: "type", value: type },
  { node, prop: "parent", value: at(parent) },
]

function batchOf(target: SpecState, base: doom.Rev): doom.Write[] {
  const writes: doom.Write[] = []
  if (target.k === "delete") writes.push({ node: x, prop: "parent", value: null, base })
  if (target.k === "shelve") writes.push({ node: x, prop: "parent", value: at(inner), base })
  if (target.o === "newN")
    writes.push(...made(drawn, "shape", startIds.slide), {
      node: drawn,
      prop: "geometry",
      value: lineOf(endOf(target.a)),
    })
  if (target.o === "moveL")
    writes.push(
      { node: line, prop: "parent", value: at(holder) },
      { node: line, prop: "geometry", value: lineOf(endOf(target.a)) },
    )
  if (target.o === "lineM") writes.push({ node: plain, prop: "geometry", value: lineOf(endOf(target.a)) })
  if (target.f === "drop") writes.push({ node: frame, prop: "parent", value: null, base })
  if (target.f === "restore") writes.push({ node: frame, prop: "parent", value: at(startIds.slide), base })
  return writes
}

function nameOf(end: doom.End | undefined): string {
  if (end === undefined || !("node" in end)) return "free"
  return end.node === x ? "X" : end.node === y ? "Y" : end.node
}

function startOf(fold: doom.Doom, node: doom.NodeId): doom.End | undefined {
  const geometry = doom.propOf(fold.nodes.get(node), "geometry")
  return geometry?.kind === "line" ? geometry.start : undefined
}

function picture(fold: doom.Doom) {
  const nOn = doom.slideOf(fold, drawn) !== undefined
  const mOn = startOf(fold, plain) !== undefined
  return {
    xOn: doom.slideOf(fold, x) !== undefined,
    s: nameOf(startOf(fold, line)),
    nOn,
    ns: nOn ? nameOf(startOf(fold, drawn)) : "free",
    mOn,
    ms: mOn ? nameOf(startOf(fold, plain)) : "free",
    fOn: doom.slideOf(fold, frame) !== undefined,
    rs: nameOf(startOf(fold, kept)),
  }
}

type Replay = { readonly db: Sql; readonly email: string }

async function stored({ db, email }: Replay, deck: string): Promise<doom.Doom> {
  const opened = await openDoom(db, { deck: deck as never }, email)
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const fold = doom.readFold(opened.fold)
  if (fold === undefined) throw new Error("unreadable fold")
  return fold
}

async function sent({ db, email }: Replay, deck: string, once: string, writes: readonly doom.Write[]) {
  return editDoom(db, { deck: deck as never, edit: { once, author: { kind: "person", id: "replay" }, writes } }, email)
}

async function seeded(replay: Replay, source: SpecState): Promise<string> {
  const deck = `batch${randomBytes(6).toString("hex")}`
  await createDoom(replay.db, { deck: deck as never }, replay.email)
  const steps: doom.Write[][] = [
    [
      ...made(x, "shape", startIds.slide),
      { node: x, prop: "box", value: placed(300) },
      ...made(y, "shape", startIds.slide),
      { node: y, prop: "box", value: placed(600) },
      ...made(shelf, "frame", startIds.slide),
      ...made(inner, "frame", shelf),
      ...made(holder, "frame", startIds.slide),
      ...made(line, "shape", startIds.slide),
      { node: line, prop: "geometry", value: lineOf(endOf(source.s)) },
      ...made(plain, "shape", startIds.slide),
      { node: plain, prop: "box", value: placed(0) },
      ...made(frame, "frame", startIds.slide),
      { node: frame, prop: "box", value: placed(100) },
      ...made(kept, "shape", frame),
      { node: kept, prop: "geometry", value: lineOf(endOf(source.rs)) },
    ],
    [{ node: shelf, prop: "parent", value: null }],
  ]
  if (source.mOn === true) steps[0]?.push({ node: plain, prop: "geometry", value: lineOf(endOf(source.ms)) })
  if (source.fOn !== true) steps.push([{ node: frame, prop: "parent", value: null }])
  if (source.nOn === true)
    steps[0]?.push(...made(drawn, "shape", startIds.slide), {
      node: drawn,
      prop: "geometry",
      value: lineOf(endOf(source.ns)),
    })
  if (source.xOn !== true) steps.push([{ node: x, prop: "parent", value: null }])
  for (const [index, writes] of steps.entries()) {
    const landed = await sent(replay, deck, `seed-${String(index)}`, writes)
    if (!landed.ok) throw new Error(`seeding ${JSON.stringify(source)} was refused: ${JSON.stringify(landed)}`)
  }
  return deck
}

async function replayEdge(replay: Replay, source: SpecState, target: SpecState): Promise<string | undefined> {
  const deck = await seeded(replay, source)
  const before = await stored(replay, deck)
  if (!same(picture(before), pick(source)))
    return `seeded ${JSON.stringify(picture(before))} for ${JSON.stringify(source)}`
  const writes = batchOf(target, before.rev)
  const whole = doom.applyEdit(before, {
    once: "whole",
    author: { kind: "person", id: "replay" },
    writes,
    rev: doom.rev(before.rev + 1),
  })
  const got = await sent(replay, deck, "batch", writes)
  const after = picture(await stored(replay, deck))
  const actual = {
    ...after,
    got: got.ok ? "landed" : "refused",
    agrees: !doom.isRefusal(whole) && same(picture(whole), after),
  }
  const expected = { ...pick(target), got: target.got, agrees: target.agrees }
  return same(actual, expected)
    ? undefined
    : `${JSON.stringify(source)} - ${JSON.stringify(writes)} -> ${JSON.stringify(expected)}; actual ${JSON.stringify(actual)} ${JSON.stringify(got)}`
}

const pick = (state: SpecState) => ({
  xOn: state.xOn,
  s: state.s,
  nOn: state.nOn,
  ns: state.ns,
  mOn: state.mOn,
  ms: state.ms,
  fOn: state.fOn,
  rs: state.rs,
})

export async function replayLineEndBatches(graph: Graph, db: Sql, email: string) {
  const replay = { db, email }
  const failures: string[] = []
  const left = [...graph.edges]
  const worker = async () => {
    for (let edge = left.shift(); edge !== undefined; edge = left.shift()) {
      const source = graph.states.get(edge.from)
      const target = graph.states.get(edge.to)
      if (source === undefined || target === undefined) throw new Error("missing batch state")
      const failed = await replayEdge(replay, source, target)
      if (failed !== undefined) failures.push(failed)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return { failures, edges: graph.edges.length }
}
