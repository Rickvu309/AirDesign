import { catalog, projectTools } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import type { AiraStep, ToolState } from "@/aira/aira-loop"
import { replyPieces, stepLine } from "@/aira/aira-steps"
import { airaRefusalWords } from "@/copy/aira-copy"

function tool(name: string, state: ToolState, id = name): AiraStep {
  return { kind: "tool", id, name, state }
}

const states: readonly ToolState[] = ["working", "done", "refused", "stopped"]

describe("stepLine", () => {
  it("says what each catalog tool did in plain words, never its internal name", () => {
    for (const { name } of projectTools(catalog)) {
      for (const state of states) {
        const line = stepLine(name, state)
        if (line === null) continue
        expect(line).not.toContain("airdesign")
        expect(line).not.toContain("_")
        expect(line).toMatch(/^[A-Z]/)
      }
    }
  })

  it("writes a running step in the present tense and a finished one in the past", () => {
    expect(stepLine("airdesign_execute", "working")).toBe("Working on slides")
    expect(stepLine("airdesign_execute", "done")).toBe("Worked on slides")
    expect(stepLine("airdesign_execute", "working")).toBe("Working on slides")
    expect(stepLine("airdesign_execute", "done")).toBe("Worked on slides")
  })

  it("says a refused step could not be done and a stopped step was stopped", () => {
    expect(stepLine("airdesign_execute", "refused")).toBe("Couldn't change slides")
    expect(stepLine("airdesign_execute", "stopped")).toBe("Stopped working on slides")
  })

  it("gives every tool Aira can call its own words in each state", () => {
    for (const { name } of projectTools(catalog)) {
      if (name === "airdesign_stop_run") continue
      const said = states.map((state) => stepLine(name, state))
      expect(new Set(said).size, name).toBe(states.length)
      expect(said, name).not.toContain(stepLine("airdesign_future_tool", "done"))
    }
  })

  it("says a refused tool Aira does not know could not finish its step", () => {
    expect(stepLine("airdesign_future_tool", "refused")).toBe("Couldn't finish a step")
  })

  it("hides the call that only ends Aira's turn", () => {
    expect(stepLine("airdesign_stop_run", "done")).toBeNull()
  })

  it("names a tool it does not know by what it touched, not by its id", () => {
    expect(stepLine("airdesign_future_tool", "done")).toBe("Worked on the deck")
    expect(stepLine("airdesign_future_tool", "working")).toBe("Working on the deck")
  })
})

describe("replyPieces", () => {
  it("keeps text where it streamed and turns each run of tool calls into one row", () => {
    const pieces = replyPieces([
      { kind: "text", text: "I will change the title." },
      tool("airdesign_execute", "done"),
      { kind: "text", text: "The title now reads Hello." },
    ])
    expect(pieces).toEqual([
      { kind: "text", text: "I will change the title." },
      {
        kind: "steps",
        title: "Worked on slides",
        state: "done",
        lines: [{ id: "airdesign_execute", text: "Worked on slides", state: "done" }],
        reasons: [],
      },
      { kind: "text", text: "The title now reads Hello." },
    ])
  })

  it("lists three different steps in one sentence", () => {
    const [row] = replyPieces([
      tool("airdesign_read_skill", "done"),
      tool("airdesign_get_app_state", "done"),
      tool("airdesign_execute", "done"),
    ])
    expect(row).toMatchObject({ title: "Read a design guide, listed your decks, and worked on slides" })
  })

  it("sums up steps taken one after another in one line that expands to each step", () => {
    const [row] = replyPieces([tool("airdesign_get_app_state", "done"), tool("airdesign_execute", "done")])
    expect(row).toEqual({
      kind: "steps",
      title: "Listed your decks and worked on slides",
      state: "done",
      lines: [
        { id: "airdesign_get_app_state", text: "Listed your decks", state: "done" },
        { id: "airdesign_execute", text: "Worked on slides", state: "done" },
      ],
      reasons: [],
    })
  })

  it("says a repeated step once in the summary and lists every call when expanded", () => {
    const [row] = replyPieces([tool("airdesign_execute", "done", "a"), tool("airdesign_execute", "done", "b")])
    expect(row).toMatchObject({ title: "Worked on slides", lines: [{ id: "a" }, { id: "b" }] })
  })

  it("shows the running step on its own line after the finished ones", () => {
    const pieces = replyPieces([tool("airdesign_execute", "done"), tool("airdesign_execute", "working")])
    expect(pieces).toEqual([
      {
        kind: "steps",
        title: "Worked on slides",
        state: "done",
        lines: [{ id: "airdesign_execute", text: "Worked on slides", state: "done" }],
        reasons: [],
      },
      {
        kind: "steps",
        title: "Working on slides",
        state: "working",
        lines: [{ id: "airdesign_execute", text: "Working on slides", state: "working" }],
        reasons: [],
      },
    ])
  })

  it("marks a row refused when any of its steps was refused, so the summary says so", () => {
    const [row] = replyPieces([tool("airdesign_get_app_state", "done"), tool("airdesign_execute", "refused")])
    expect(row).toMatchObject({ title: "Listed your decks and couldn't change slides", state: "refused" })
  })

  it("says under a refused step why it was refused, once per reason", () => {
    const refused = (id: string, refusal: string): AiraStep => ({
      kind: "tool",
      id,
      name: "airdesign_execute",
      state: "refused",
      refusal,
    })
    const [row] = replyPieces([
      refused("a", "person-protected"),
      refused("b", "person-protected"),
      refused("c", "stale"),
    ])
    expect(row).toMatchObject({
      title: "Couldn't change slides",
      state: "refused",
      reasons: [airaRefusalWords["person-protected"], airaRefusalWords.stale],
    })
    expect(airaRefusalWords["person-protected"]).toBe(
      "You edited that layer while Aira was working, so Aira left it as you made it.",
    )
  })

  it("gives no reason for a refusal it has no words for, and none for a stopped step", () => {
    const [row] = replyPieces([
      { kind: "tool", id: "a", name: "airdesign_execute", state: "refused", refusal: "future" },
      { kind: "tool", id: "b", name: "airdesign_execute", state: "stopped" },
    ])
    expect(row).toMatchObject({ reasons: [] })
  })

  it("writes every refusal reason as one plain sentence or two, with no internal names", () => {
    for (const [code, words] of Object.entries(airaRefusalWords)) {
      expect(words, code).toMatch(/^[A-Z].*\.$/)
      expect(words, code).not.toMatch(/airdesign_|runId|_/)
    }
  })

  it("keeps a retried attempt's words apart from the earlier attempt's", () => {
    expect(replyPieces([{ kind: "text", text: "Done." }, { kind: "retry" }, { kind: "text", text: "Ok." }])).toEqual([
      { kind: "text", text: "Done." },
      { kind: "text", text: "Ok." },
    ])
  })

  it("leaves out the turn-ending call without splitting the row around it", () => {
    const pieces = replyPieces([
      tool("airdesign_execute", "done"),
      tool("airdesign_stop_run", "done"),
      tool("airdesign_get_app_state", "done"),
    ])
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ title: "Worked on slides and listed your decks" })
    expect(JSON.stringify(pieces)).not.toContain("stop")
  })

  it("shows nothing for a reply that only ended the turn", () => {
    expect(replyPieces([tool("airdesign_stop_run", "done")])).toEqual([])
  })
})
