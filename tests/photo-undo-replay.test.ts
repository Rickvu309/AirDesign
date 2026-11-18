import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/person-undo/view.mjs"
import { replayPhotoUndo } from "./photo-undo-replay.js"
import { dumpTopics } from "./spec-dump.js"
import { parseDot } from "./spec-graph.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

describe("person-undo replay on photos", () => {
  it("drives every edge of a person's undo through decide, with a crop as the step's field and a recolour as the run's other one", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "person-undo")
    if (spec === undefined) throw new Error("no person-undo spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const report = replayPhotoUndo(
      graph,
      (source, target, action) => `${view.state(source)} -${action}-> ${view.state(target)}`,
      failures,
    )
    expect(failures, JSON.stringify(report)).toEqual([])
    expect(report.replayed + report.told).toBe(graph.edges.length)
    expect(report.told).toBeGreaterThan(0)
  }, 60_000)
})
