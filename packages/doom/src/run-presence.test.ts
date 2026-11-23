import { describe, expect, it } from "vitest"
import {
  applyEdit,
  isRefusal,
  liveRuns,
  nodeId,
  readEdit,
  readRuns,
  rev,
  runsOf,
  runsToJson,
  type Author,
  type Doom,
  type Write,
} from "./index.js"
import { create, ids, land, once, person, sampleDeck } from "./sample-deck.js"

const claude = (run: string, name?: string): Author => ({
  kind: "agent",
  id: "claude",
  run,
  ...(name === undefined ? {} : { name }),
})

const start = (doom: Doom, author: Author, writes: readonly Write[] = []) =>
  applyEdit(doom, { once: once(), author, writes, phase: "start", rev: rev(doom.rev + 1) }) as Doom

describe("a run says who is editing and where", () => {
  it("keeps the name its agent started it with, and an unnamed start keeps no name", () => {
    const named = start(sampleDeck(), claude("c1", "Claude Code"))
    expect(named.runs.get("c1")).toMatchObject({ agent: "claude", name: "Claude Code" })
    expect(start(sampleDeck(), claude("c2")).runs.get("c2")?.name).toBe("")
  })

  it("names the slide its last write landed on, and keeps it through a stop with no writes", () => {
    const running = start(sampleDeck(), claude("c1", "Claude Code"))
    expect(running.runs.get("c1")?.slide).toBeUndefined()
    const wrote = land(running, [{ node: ids.card, prop: "name", value: "A" }], claude("c1"))
    expect(wrote.runs.get("c1")?.slide).toBe(ids.slide)
    const other = nodeId("t:90")
    const added = land(wrote, create(other, "slide", ids.row), claude("c1"))
    expect(added.runs.get("c1")?.slide).toBe(other)
    const stopped = applyEdit(added, {
      once: once(),
      author: claude("c1"),
      writes: [],
      phase: "stop",
      rev: rev(added.rev + 1),
    }) as Doom
    expect(stopped.runs.get("c1")).toMatchObject({ phase: "stopped", slide: other })
  })

  it("reads an agent's name from an edit, and refuses a name on a person", () => {
    const read = readEdit({ once: "o1", author: claude("c1", "Codex"), writes: [], phase: "start" }, sampleDeck())
    expect(read).toMatchObject({ author: { name: "Codex" } })
    const named = readEdit({ once: "o2", author: { ...person, name: "Quan" }, writes: [] }, sampleDeck())
    expect(isRefusal(named) && named.refused).toBe("shape")
  })

  it("stores the name and slide with the run, and reads an older run as unnamed and nowhere", () => {
    const wrote = land(
      start(sampleDeck(), claude("c1", "Claude Code")),
      [{ node: ids.card, prop: "name", value: "A" }],
      claude("c1"),
    )
    const read = readRuns(JSON.parse(JSON.stringify(runsToJson(wrote.runs))))
    expect(read?.get("c1")).toMatchObject({ name: "Claude Code", slide: ids.slide })
    const older = readRuns({ old: { phase: "running", guarded: [], agent: "claude", started: 2, wrote: 3 } })
    expect(older?.get("old")).toMatchObject({ name: "" })
    expect(older?.get("old")?.slide).toBeUndefined()
  })
})

describe("the runs a person and an agent see", () => {
  it("lists every owned run newest first, and only the running ones as live", () => {
    const first = start(sampleDeck(), claude("c1", "Claude Code"))
    const second = start(first, { kind: "agent", id: "aira", run: "a1", name: "Aira" })
    const third = start(second, claude("c2", "Claude Code"))
    expect(runsOf(third).map((run) => run.id)).toEqual(["c2", "a1", "c1"])
    expect(liveRuns(third).map((run) => run.id)).toEqual(["c2", "a1"])
  })

  it("leaves out an older run that names no agent, which no one can write into or stop", () => {
    const fold = { ...sampleDeck(), runs: readRuns({ old: { phase: "running", guarded: [] } })! }
    expect(runsOf(fold)).toEqual([])
  })
})
