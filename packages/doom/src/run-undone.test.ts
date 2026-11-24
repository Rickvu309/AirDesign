import { describe, expect, it } from "vitest"
import { applyEdit, isRefusal, readEdit, readRuns, rev, runsToJson, type Author, type Doom } from "./index.js"
import { ids, land, once, person, sampleDeck } from "./sample-deck.js"

const claude: Author = { kind: "agent", id: "claude", run: "c1", name: "Claude Code" }

function ranAndStopped(): Doom {
  const started = applyEdit(sampleDeck(), {
    once: once(),
    author: claude,
    writes: [{ node: ids.card, prop: "name", value: "Agent" }],
    phase: "start",
    rev: rev(sampleDeck().rev + 1),
  }) as Doom
  return applyEdit(started, {
    once: once(),
    author: claude,
    writes: [],
    phase: "stop",
    rev: rev(started.rev + 1),
  }) as Doom
}

const turn = (doom: Doom, undone: boolean, by: Author = person) =>
  applyEdit(doom, {
    once: once(),
    author: by,
    writes: [],
    runUndo: { run: "c1", undone },
    rev: rev(doom.rev + 1),
  })

describe("a run's undone mark", () => {
  it("is set by the person's undo edit of that run and cleared by its redo, for every device that folds it", () => {
    const ran = ranAndStopped()
    expect(ran.runs.get("c1")?.undone).toBe(false)
    const undone = turn(ran, true) as Doom
    expect(undone.runs.get("c1")).toMatchObject({ undone: true, phase: "stopped" })
    expect((turn(undone, false) as Doom).runs.get("c1")?.undone).toBe(false)
    expect(readRuns(JSON.parse(JSON.stringify(runsToJson(undone.runs))))?.get("c1")?.undone).toBe(true)
  })

  it("is written by the person, or by the agent of that run, and a mark on a run that is not there is refused", () => {
    const ran = ranAndStopped()
    const own = turn(ran, true, claude)
    expect(isRefusal(own)).toBe(false)
    expect((own as Doom).runs.get("c1")?.undone).toBe(true)
    expect(
      isRefusal(readEdit({ once: "a", author: claude, writes: [], runUndo: { run: "c1", undone: true } }, ran)),
    ).toBe(false)
    const other: Author = { kind: "agent", id: "other", run: "c1", name: "Other" }
    expect(isRefusal(turn(ran, true, other))).toBe(true)
    expect(
      isRefusal(
        readEdit(
          {
            once: "b",
            author: { kind: "agent", id: "claude", run: "c2" },
            writes: [],
            runUndo: { run: "c1", undone: true },
          },
          ran,
        ),
      ),
    ).toBe(true)
    const elsewhere = applyEdit(ran, {
      once: once(),
      author: person,
      writes: [],
      runUndo: { run: "nope", undone: true },
      rev: rev(ran.rev + 1),
    })
    expect(isRefusal(elsewhere) && elsewhere.refused).toBe("shape")
  })

  it("reads from an edit and stays on it through JSON", () => {
    const read = readEdit(
      { once: "u1", author: person, writes: [], runUndo: { run: "c1", undone: true } },
      sampleDeck(),
    )
    expect(read).toMatchObject({ runUndo: { run: "c1", undone: true } })
    expect(isRefusal(readEdit({ once: "u2", author: person, writes: [], runUndo: { run: "c1" } }, sampleDeck()))).toBe(
      true,
    )
  })

  it("reads an older stored run as not undone", () => {
    expect(readRuns({ old: { phase: "stopped", guarded: [], agent: "claude" } })?.get("old")?.undone).toBe(false)
  })

  it("leaves the run's writes to the undo's own writes: the mark changes no layer", () => {
    const undone = turn(ranAndStopped(), true) as Doom
    expect(undone.nodes.get(ids.card)).toMatchObject({ name: "Agent" })
    expect(land(undone, [{ node: ids.card, prop: "name", value: "Mine" }]).runs.get("c1")?.undone).toBe(true)
  })

  it("is cleared when the run's agent writes into it again, so its new work can be undone", () => {
    const started = applyEdit(sampleDeck(), {
      once: once(),
      author: claude,
      writes: [{ node: ids.card, prop: "name", value: "Agent" }],
      phase: "start",
      rev: rev(sampleDeck().rev + 1),
    }) as Doom
    const undone = turn(started, true) as Doom
    expect(undone.runs.get("c1")).toMatchObject({ undone: true, phase: "running" })
    const again = land(undone, [{ node: ids.card, prop: "opacity", value: 0.5 }], claude)
    expect(again.runs.get("c1")?.undone).toBe(false)
  })
})
