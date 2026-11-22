import { describe, expect, it } from "vitest"

import { pathsFrom, walks, type Graph } from "./spec-graph.js"

const graph: Graph = {
  states: new Map([
    ["1", { at: "start" }],
    ["2", { at: "left" }],
    ["3", { at: "right" }],
    ["4", { at: "end" }],
  ]),
  edges: [
    { from: "1", to: "2", action: "GoLeft" },
    { from: "1", to: "3", action: "GoRight" },
    { from: "2", to: "4", action: "Finish" },
    { from: "3", to: "4", action: "Finish" },
    { from: "4", to: "1", action: "Again" },
    { from: "4", to: "4", action: "Done" },
  ],
}

describe("walks", () => {
  const paths = pathsFrom(graph, (state) => state.at === "start")
  const found = walks(graph, paths)
  const taken = found.flatMap((walk) => {
    let at = walk.root
    return walk.steps.map((step) => {
      const edge = graph.edges.find((row) => row.from === at && row.action === step.action && row.to === step.to)
      at = step.to
      return edge
    })
  })

  it("start at a root and follow only edges of the graph", () => {
    expect(found.every((walk) => walk.root === "1")).toBe(true)
    expect(taken).not.toContain(undefined)
  })

  it("take every edge but Done at least once, in fewer steps than one path per edge", () => {
    const edges = graph.edges.filter((edge) => edge.action !== "Done")
    expect(edges.filter((edge) => !taken.includes(edge))).toEqual([])
    const perEdge = edges.reduce((sum, edge) => sum + (paths.get(edge.from)?.steps.length ?? 0) + 1, 0)
    expect(taken.length).toBeLessThan(perEdge)
  })
})
