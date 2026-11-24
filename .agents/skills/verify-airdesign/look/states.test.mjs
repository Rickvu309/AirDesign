import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { matching, shardStates, states, sweep, sweepLanes, units } from "./states.mjs"

const canvasSelection = /\.locator\(["']\[data-slide-paint\] \[data-selection\]["']\)$/

function oneSelectionWaits(source) {
  const selectionNames = new Set(
    [...source.matchAll(/\bconst (\w+) = ([^\n]+)/g)]
      .filter(([, , value]) => canvasSelection.test(value))
      .map(([, name]) => name),
  )
  return [...source.matchAll(/\bexpect\(([^\n]+)\)\.toHaveCount\(1\)/g)].filter(
    ([, target]) => selectionNames.has(target) || canvasSelection.test(target),
  )
}

describe("states", () => {
  it("names each state once and points each journey state at a capture its journey makes", () => {
    expect(new Set(states.map((state) => state.name)).size).toBe(states.length)
    for (const state of states.filter((each) => each.journey)) {
      const source = readFileSync(new URL(`../journeys/${state.journey}.mjs`, import.meta.url), "utf8")
      expect(source, `${state.name} waits for capture("${state.at}")`).toContain(`capture("${state.at}")`)
    }
    for (const state of states) expect(state.design === null || state.design.startsWith("/screens/s")).toBe(true)
  })

  it("reads one state from each file in states/, named after its file and sorted by name", () => {
    const files = readdirSync(new URL("./states/", import.meta.url)).sort()
    expect(states.map((state) => `${state.name}.mjs`)).toEqual(files)
  })

  it("waits for the new layer when a state already saw one canvas selection", () => {
    for (const { name } of states) {
      const source = readFileSync(new URL(`./states/${name}.mjs`, import.meta.url), "utf8")
      expect(
        oneSelectionWaits(source).length,
        `${name}.mjs counts one canvas selection again. Wait for the new layer with toHaveAttribute("data-selection", expectedNode).`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it("selects states with a star", () => {
    expect(matching("agent-*").map((state) => state.name)).toEqual([
      "agent-malformed",
      "agent-not-offered",
      "agent-off",
      "agent-out-of-usage",
      "agent-retried",
      "agent-shapes-placed",
    ])
  })

  it("walks each journey once for all of its states", () => {
    const grouped = units(matching("agent-*"))
    expect(grouped.map((unit) => unit.states.map((state) => state.name))).toEqual([
      ["agent-malformed"],
      ["agent-not-offered"],
      ["agent-off"],
      ["agent-out-of-usage"],
      ["agent-retried"],
      ["agent-shapes-placed"],
    ])
  })

  it("sweeps three lanes on a four-core ci runner and one lane per four cores on a larger machine, at most eight", () => {
    expect([2, 4, 8, 16, 20, 32, 48, 96].map(sweepLanes)).toEqual([3, 3, 3, 4, 5, 8, 8, 8])
  })

  it("puts every state in exactly one design shard and keeps each journey's states together", () => {
    const largestUnit = Math.max(...units(states).map((unit) => unit.states.length))
    const airaUnits = units(states).filter((unit) => unit.aira).length
    for (const total of [1, 2, 3, 5]) {
      const shards = Array.from({ length: total }, (_, index) => shardStates(states, { current: index + 1, total }))
      expect(shards.flat().map((state) => state.name)).toEqual(
        expect.arrayContaining(states.map((state) => state.name)),
      )
      expect(shards.flat()).toHaveLength(states.length)
      for (const unit of units(states))
        expect(shards.filter((shard) => unit.states.some((state) => shard.includes(state)))).toHaveLength(1)
      const sizes = shards.map((shard) => shard.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(largestUnit)
      if (total <= Math.min(2, airaUnits))
        for (const shard of shards) expect(units(shard).some((unit) => unit.aira)).toBe(true)
    }
  })

  it("keeps sweeping after a state fails and names only the state not reached", async () => {
    const reached = []
    const drive = (fails) => async () => {
      if (fails) throw new Error("no alert\nstack")
    }
    const failures = await sweep(
      [
        { name: "first", drive: drive(false) },
        { name: "second", drive: drive(true) },
        { name: "third", drive: drive(false) },
      ],
      async () => ({ kit: {}, close: async () => undefined }),
      async (state) => {
        reached.push(state.name)
      },
      2,
    )
    expect(failures).toEqual([{ state: "second", error: "no alert" }])
    expect(reached.sort()).toEqual(["first", "third"])
  })
})
