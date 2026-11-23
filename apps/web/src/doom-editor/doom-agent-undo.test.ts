import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { airaChat, undoExchange, type AiraChat } from "@/aira/aira-loop"
import { doomAgentUndo } from "./doom-agent-undo"

const deck = "deck"
const done: AiraChat = {
  ...airaChat(deck),
  exchanges: [{ asked: "Add a KPI slide", steps: [], end: "done", runs: ["run-1", "run-2"] }],
}
const saved = Promise.resolve()
const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [
    {
      children: [
        { type: "shape", name: "Revenue", props: { text: doom.textFromMarkdown("$4.2M", "body") } },
        { type: "frame", props: { sizing: { w: "hug", h: "hug" } }, children: [{ type: "shape" }] },
      ],
    },
  ],
})
const kept = grown.doom
const [named, group] = kept.children.get(grown.slides[0]!) ?? []
const ids = { named: named!, group: group! }

function client(answers: Record<string, Awaited<ReturnType<Parameters<typeof doomAgentUndo>[0]["undoRun"]>>>) {
  const asked: string[] = []
  return {
    asked,
    view: () => kept,
    undoRun: async (run: string) => {
      asked.push(run)
      return answers[run] ?? { ok: false as const, reason: "nothing" as const }
    },
  }
}

describe("undoing an Aira exchange on a doom deck", () => {
  it("takes the runs back newest first through the open deck and marks the exchange undone", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved, kept: [] },
      "run-2": { ok: true, once: "u2", saved, kept: [] },
    })
    const undone = await undoExchange(done, 0, doomAgentUndo(open))
    expect(open.asked).toEqual(["run-2", "run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
    expect(undone?.exchanges[0]?.kept).toBeUndefined()
  })

  it("names the layers each run kept because they were changed after Aira made them", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved, kept: [ids.named, ids.group] },
      "run-2": { ok: true, once: "u2", saved, kept: [ids.named] },
    })
    const undone = await undoExchange(done, 0, doomAgentUndo(open))
    expect(undone?.exchanges[0]).toMatchObject({ end: "undone", kept: ["“Revenue”", "a group"] })
  })

  it("says the undo is refused when a person's newer write left nothing to take back", async () => {
    const open = client({ "run-2": { ok: false, reason: "nothing" } })
    const refused = await undoExchange(done, 0, doomAgentUndo(open))
    expect(refused?.exchanges[0]).toMatchObject({ end: "done", undoRefused: true })
  })

  it("keeps Undo and the runs still left when the deck cannot be reached", async () => {
    const open = client({
      "run-2": { ok: true, once: "u2", saved, kept: [] },
      "run-1": { ok: false, reason: "offline" },
    })
    const failed = await undoExchange(done, 0, doomAgentUndo(open))
    expect(failed?.exchanges[0]).toMatchObject({ end: "done", runs: ["run-1"], undoFailed: true })
  })

  it("leaves a run the deck already shows undone, so undoing from the chat after the list lands nothing twice", async () => {
    const open = { ...client({ "run-1": { ok: true, once: "u1", saved, kept: [] } }) }
    const undoneTwo = {
      ...kept,
      runs: new Map([
        [
          "run-2",
          {
            phase: "stopped",
            guarded: new Set(),
            agent: "aira",
            name: "Aira",
            undone: true,
            started: doom.rev(1),
            wrote: doom.rev(1),
          },
        ],
      ]),
    } as doom.Doom
    const undone = await undoExchange(done, 0, doomAgentUndo({ ...open, view: () => undoneTwo }))
    expect(open.asked).toEqual(["run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
  })
})
