import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { airaChat, type AiraChat } from "@/aira/aira-loop"
import { undoExchange } from "@/aira/aira-undo"
import { undoAgentRun } from "./agent-undo"

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

function client(answers: Record<string, Awaited<ReturnType<Parameters<typeof undoAgentRun>[0]["undoRun"]>>>) {
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
      "run-1": { ok: true, once: "u1", saved, kept: [], left: [], waiting: [] },
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [] },
    })
    const undone = await undoExchange(done, 0, undoAgentRun(open))
    expect(open.asked).toEqual(["run-2", "run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
    expect(undone?.exchanges[0]?.kept).toBeUndefined()
  })

  it("names the layers each run kept because they were changed after Aira made them", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved, kept: [ids.named, ids.group], left: [], waiting: [] },
      "run-2": { ok: true, once: "u2", saved, kept: [ids.named], left: [], waiting: [] },
    })
    const undone = await undoExchange(done, 0, undoAgentRun(open))
    expect(undone?.exchanges[0]).toMatchObject({ end: "undone", kept: ["“Revenue”", "a group"] })
  })

  it("names an earlier layer separately when only its later changes were kept", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved, kept: [ids.named, ids.group], later: [ids.named], left: [], waiting: [] },
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [] },
    })
    const undone = await undoExchange(done, 0, undoAgentRun(open))
    expect(undone?.exchanges[0]).toMatchObject({ end: "undone", kept: ["a group"], later: ["“Revenue”"] })
  })

  it("names the layers a run's undo leaves where they are because the frame they came from is gone", async () => {
    const open = client({
      "run-1": { ok: true, once: "u1", saved, kept: [], left: [ids.named], waiting: [] },
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [ids.named], waiting: [] },
    })
    const undone = await undoExchange(done, 0, undoAgentRun(open))
    expect(undone?.exchanges[0]).toMatchObject({ end: "undone", left: ["“Revenue”"] })
    expect(undone?.exchanges[0]?.kept).toBeUndefined()
  })

  it("names a component whose update a run's undo skipped because the component was deleted", async () => {
    const open = client({
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [], skipped: [ids.named] },
      "run-1": { ok: true, once: "u1", saved, kept: [], left: [], waiting: [] },
    })
    const undone = await undoExchange(done, 0, undoAgentRun(open))
    expect(undone?.exchanges[0]).toMatchObject({ end: "undone", skipped: ["“Revenue”"] })
  })

  it("names what stays and keeps Undo when a run's undo lands nothing, instead of saying it was refused", async () => {
    const open = client({
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [ids.group] },
      "run-1": { ok: false, reason: "left", kept: [], left: [ids.named], waiting: [] },
    })
    const stays = await undoExchange(done, 0, undoAgentRun(open))
    expect(stays?.exchanges[0]).toMatchObject({ end: "done", left: ["“Revenue”"], waiting: ["a group"] })
    expect(stays?.exchanges[0]?.undoRefused).toBeUndefined()
  })

  it("says the undo is refused when a person's newer write left nothing to take back, and lets them try again", async () => {
    const open = client({ "run-2": { ok: false, reason: "nothing" } })
    const refused = await undoExchange(done, 0, undoAgentRun(open))
    expect(refused?.exchanges[0]).toMatchObject({ end: "done", undoRefused: true })
    const again = await undoExchange(
      refused!,
      0,
      undoAgentRun(
        client({
          "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [] },
          "run-1": { ok: true, once: "u1", saved, kept: [], left: [], waiting: [] },
        }),
      ),
    )
    expect(again?.exchanges[0]).toMatchObject({ end: "undone" })
  })

  it("keeps Undo and the runs still left when the deck cannot be reached", async () => {
    const open = client({
      "run-2": { ok: true, once: "u2", saved, kept: [], left: [], waiting: [] },
      "run-1": { ok: false, reason: "offline" },
    })
    const failed = await undoExchange(done, 0, undoAgentRun(open))
    expect(failed?.exchanges[0]).toMatchObject({ end: "done", runs: ["run-1"], undoFailed: true })
  })

  it("leaves a run the deck already shows undone, so undoing from the chat after the list lands nothing twice", async () => {
    const open = { ...client({ "run-1": { ok: true, once: "u1", saved, kept: [], left: [], waiting: [] } }) }
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
    const undone = await undoExchange(done, 0, undoAgentRun({ ...open, view: () => undoneTwo }))
    expect(open.asked).toEqual(["run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
  })
})

it("preserves the size refusal for the exchange's undo notice", async () => {
  const open = client({ "run-2": { ok: false, reason: "size" } })
  const result = await undoExchange(done, 0, undoAgentRun(open))
  expect(result?.exchanges[0]).toMatchObject({ end: "done", undoFailed: "size" })
})
