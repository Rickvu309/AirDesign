import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { matching, states, sweep, units } from "./states.mjs"

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

  it("selects states with a star", () => {
    expect(matching("agent-*").map((state) => state.name)).toEqual([
      "agent-done",
      "agent-empty",
      "agent-failed",
      "agent-not-offered",
      "agent-out-of-usage",
      "agent-working",
    ])
  })

  it("walks each journey once for all of its states", () => {
    const grouped = units(matching("agent-*"))
    expect(grouped.map((unit) => unit.states.map((state) => state.name))).toEqual([
      ["agent-done", "agent-empty", "agent-failed", "agent-working"],
      ["agent-not-offered"],
      ["agent-out-of-usage"],
    ])
    expect(grouped[0].aira).toBe(true)
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
