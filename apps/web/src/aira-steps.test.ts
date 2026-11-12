import { catalog, projectTools } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import type { AiraStep, ToolState } from "@/aira-loop"
import { replyPieces, stepLine } from "@/aira-steps"

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
    expect(stepLine("airdesign_edit_deck", "working")).toBe("Editing slides")
    expect(stepLine("airdesign_edit_deck", "done")).toBe("Edited slides")
    expect(stepLine("airdesign_read_deck", "working")).toBe("Reading the deck")
    expect(stepLine("airdesign_read_deck", "done")).toBe("Read the deck")
  })

  it("says a refused step could not be done and a stopped step was stopped", () => {
    expect(stepLine("airdesign_edit_deck", "refused")).toBe("Couldn't edit slides")
    expect(stepLine("airdesign_edit_deck", "stopped")).toBe("Stopped editing slides")
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
      tool("airdesign_edit_deck", "done"),
      { kind: "text", text: "The title now reads Hello." },
    ])
    expect(pieces).toEqual([
      { kind: "text", text: "I will change the title." },
      {
        kind: "steps",
        title: "Edited slides",
        state: "done",
        lines: [{ id: "airdesign_edit_deck", text: "Edited slides", state: "done" }],
      },
      { kind: "text", text: "The title now reads Hello." },
    ])
  })

  it("lists three different steps in one sentence", () => {
    const [row] = replyPieces([
      tool("airdesign_read_deck", "done"),
      tool("airdesign_capture_slide", "done"),
      tool("airdesign_edit_deck", "done"),
    ])
    expect(row).toMatchObject({ title: "Read the deck, viewed a slide, and edited slides" })
  })

  it("sums up steps taken one after another in one line that expands to each step", () => {
    const [row] = replyPieces([tool("airdesign_read_deck", "done"), tool("airdesign_edit_deck", "done")])
    expect(row).toEqual({
      kind: "steps",
      title: "Read the deck and edited slides",
      state: "done",
      lines: [
        { id: "airdesign_read_deck", text: "Read the deck", state: "done" },
        { id: "airdesign_edit_deck", text: "Edited slides", state: "done" },
      ],
    })
  })

  it("says a repeated step once in the summary and lists every call when expanded", () => {
    const [row] = replyPieces([tool("airdesign_edit_deck", "done", "a"), tool("airdesign_edit_deck", "done", "b")])
    expect(row).toMatchObject({ title: "Edited slides", lines: [{ id: "a" }, { id: "b" }] })
  })

  it("shows the running step on its own line after the finished ones", () => {
    const pieces = replyPieces([tool("airdesign_read_deck", "done"), tool("airdesign_edit_deck", "working")])
    expect(pieces).toEqual([
      {
        kind: "steps",
        title: "Read the deck",
        state: "done",
        lines: [{ id: "airdesign_read_deck", text: "Read the deck", state: "done" }],
      },
      {
        kind: "steps",
        title: "Editing slides",
        state: "working",
        lines: [{ id: "airdesign_edit_deck", text: "Editing slides", state: "working" }],
      },
    ])
  })

  it("marks a row refused when any of its steps was refused, so the summary says so", () => {
    const [row] = replyPieces([tool("airdesign_read_deck", "done"), tool("airdesign_edit_deck", "refused")])
    expect(row).toMatchObject({ title: "Read the deck and couldn't edit slides", state: "refused" })
  })

  it("leaves out the turn-ending call without splitting the row around it", () => {
    const pieces = replyPieces([
      tool("airdesign_edit_deck", "done"),
      tool("airdesign_stop_run", "done"),
      tool("airdesign_read_deck", "done"),
    ])
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ title: "Edited slides and read the deck" })
    expect(JSON.stringify(pieces)).not.toContain("stop")
  })

  it("shows nothing for a reply that only ended the turn", () => {
    expect(replyPieces([tool("airdesign_stop_run", "done")])).toEqual([])
  })
})
