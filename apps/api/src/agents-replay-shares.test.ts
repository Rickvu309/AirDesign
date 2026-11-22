import { readdirSync, readFileSync } from "node:fs"

import { beforeAll, describe, expect, it } from "vitest"

import { agentsWalks, shareCount, shareOf } from "./agents-replay.js"
import { specGraph, type Graph, type Path } from "./spec-graph.js"

const folder = new URL("./", import.meta.url)

describe("agents replay shares", () => {
  let covering: readonly Path[]
  let graph: Graph

  beforeAll(async () => {
    ;({ covering } = await agentsWalks())
    graph = await specGraph("agents", "Agents")
  }, 60_000)

  it("has one test file per share, each replaying its own share", () => {
    const files = readdirSync(folder)
      .filter((name) => /^agents-replay-\d+\.test\.ts$/.test(name))
      .toSorted()
    const shares = Array.from({ length: shareCount }, (_, share) => share)
    expect(files).toEqual(shares.map((share) => `agents-replay-${String(share)}.test.ts`))
    for (const share of shares) {
      const text = readFileSync(new URL(`agents-replay-${String(share)}.test.ts`, folder), "utf8")
      expect(text.match(/replayShare\(\d+\)/g)).toEqual([`replayShare(${String(share)})`])
    }
  })

  it("splits the walks of the agents model so every walk is in exactly one share, in order", () => {
    expect(covering.length).toBeGreaterThan(shareCount)
    const shares = Array.from({ length: shareCount }, (_, share) => shareOf(covering, share))
    for (const share of shares) expect(share.length).toBeGreaterThan(0)
    const joined = shares.flat().toSorted((left, right) => left.index - right.index)
    expect(joined.map(({ index }) => index)).toEqual(covering.map((_, index) => index))
    expect(joined.map(({ walk }) => walk)).toEqual(covering)
    const driven = new Set<string>()
    for (const { walk } of joined) {
      let from = walk.root
      for (const step of walk.steps) {
        driven.add(`${from} ${step.action} ${step.to}`)
        from = step.to
      }
    }
    const edges = graph.edges.filter((edge) => edge.action !== "Done")
    expect(edges.filter((edge) => !driven.has(`${edge.from} ${edge.action} ${edge.to}`))).toEqual([])
  })
})
