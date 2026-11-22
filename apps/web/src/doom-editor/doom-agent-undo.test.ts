import { describe, expect, it } from "vitest"
import { airaChat, undoExchange, type AiraChat } from "@/aira-loop"
import { doomAgentUndo } from "./doom-agent-undo"

const deck = "deck"
const done: AiraChat = {
  ...airaChat(deck),
  exchanges: [{ asked: "Add a KPI slide", steps: [], end: "done", runs: ["run-1", "run-2"] }],
}
const saved = Promise.resolve()

function client(answers: Record<string, Awaited<ReturnType<Parameters<typeof doomAgentUndo>[0]["undoRun"]>>>) {
  const asked: string[] = []
  return {
    asked,
    undoRun: async (run: string) => {
      asked.push(run)
      return answers[run] ?? { ok: false as const, reason: "nothing" as const }
    },
  }
}

describe("undoing an Aira exchange on a doom deck", () => {
  it("takes the runs back newest first through the open deck and marks the exchange undone", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved },
      "run-2": { ok: true, once: "u2", saved },
    })
    const undone = await undoExchange(done, 0, doomAgentUndo(open))
    expect(open.asked).toEqual(["run-2", "run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
  })

  it("says the undo is refused when a person's newer write left nothing to take back", async () => {
    const open = client({ "run-2": { ok: false, reason: "nothing" } })
    const refused = await undoExchange(done, 0, doomAgentUndo(open))
    expect(refused?.exchanges[0]).toMatchObject({ end: "done", undoRefused: true })
  })

  it("keeps Undo and the runs still left when the deck cannot be reached", async () => {
    const open = client({ "run-2": { ok: true, once: "u2", saved }, "run-1": { ok: false, reason: "offline" } })
    const failed = await undoExchange(done, 0, doomAgentUndo(open))
    expect(failed?.exchanges[0]).toMatchObject({ end: "done", runs: ["run-1"], undoFailed: true })
  })
})
