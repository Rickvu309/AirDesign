import { describe, expect, it } from "vitest"
import { airaChat, settledByRuns, type AiraExchange } from "./aira-loop"

const done: AiraExchange = { asked: "Add KPIs", steps: [], end: "done", runs: ["r1", "r2"] }
const states = (map: Record<string, boolean>) => (run: string) => map[run]

describe("an Aira request read against its runs in the deck", () => {
  it("shows as undone once every run it made is undone in the deck, wherever the undo came from", () => {
    expect(settledByRuns(done, states({ r1: true, r2: true })).end).toBe("undone")
    expect(settledByRuns({ ...done, undoRefused: true }, states({ r1: true, r2: true }))).toEqual({
      ...done,
      end: "undone",
    })
  })

  it("offers Undo again when the deck has its runs back, as after a redo", () => {
    const undone: AiraExchange = { ...done, end: "undone", kept: ["“Revenue”"], left: ["“Card”"] }
    expect(settledByRuns(undone, states({ r1: false, r2: true }))).toEqual({ ...done, end: "done" })
  })

  it("keeps what the chat says while a run is not in the deck, or the request is still working", () => {
    expect(settledByRuns(done, states({ r1: true }))).toBe(done)
    const working: AiraExchange = { ...done, end: "working" }
    expect(settledByRuns(working, states({ r1: true, r2: true }))).toBe(working)
    expect(airaChat("d").exchanges).toEqual([])
  })
})
