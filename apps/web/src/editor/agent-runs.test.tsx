import * as doom from "@airdesign/doom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { agentRunsCopy } from "@/copy/agent-runs-copy"
import { AgentAtWork } from "./agent-at-work"
import { AgentRuns } from "./agent-runs"

const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [{ children: [{ type: "shape", name: "Title" }] }, { children: [{ type: "shape", name: "Chart" }] }],
})
const [first, second] = grown.slides as [doom.NodeId, doom.NodeId]
const layerOn = (slide: doom.NodeId) => grown.doom.children.get(slide)![0]!

function landed(fold: doom.Doom, edit: doom.Edit): doom.Doom {
  const next = doom.applyEdit(fold, { ...edit, rev: doom.rev(fold.rev + 1) })
  if (doom.isRefusal(next)) throw new Error(next.refused)
  return next
}

const by = (id: string, run: string, name?: string): doom.Author => ({
  kind: "agent",
  id,
  run,
  ...(name === undefined ? {} : { name }),
})

function deckWithRuns(): doom.Doom {
  let fold = grown.doom
  fold = landed(fold, {
    once: "a1",
    author: by("aira", "a1", "Aira"),
    writes: [{ node: layerOn(first), prop: "name", value: "A" }],
    phase: "start",
  })
  fold = landed(fold, { once: "a1-stop", author: by("aira", "a1"), writes: [], phase: "stop" })
  fold = landed(fold, {
    once: "c1",
    author: by("claude", "c1", "Claude Code"),
    writes: [{ node: layerOn(second), prop: "name", value: "C" }],
    phase: "start",
  })
  return fold
}

const undo = async () => ({ ok: false, reason: "nothing" }) as const

describe("the agents on a deck, in the Agent panel", () => {
  it("lists each run newest first by its agent's name, the live one editing its slide and the rest with Undo", () => {
    const markup = renderToStaticMarkup(<AgentRuns view={deckWithRuns()} editing={new Set(["c1"])} undoRun={undo} />)
    expect(markup).toContain(agentRunsCopy.title)
    expect(markup.indexOf("Claude Code")).toBeLessThan(markup.indexOf("Aira"))
    expect(markup).toContain("Editing slide 2")
    expect(markup).toContain("Last edited slide 1")
    expect(markup.match(/data-agent-run-undo/g)).toHaveLength(1)
  })

  it("offers Undo on an open run that has gone quiet, and shows a run undone in the deck as Undone", () => {
    const quiet = renderToStaticMarkup(<AgentRuns view={deckWithRuns()} editing={new Set()} undoRun={undo} />)
    expect(quiet).toContain("Last edited slide 2")
    expect(quiet.match(/data-agent-run-undo/g)).toHaveLength(2)
    const undone = landed(deckWithRuns(), {
      once: "u1",
      author: { kind: "person", id: "tab" },
      writes: [],
      runUndo: { run: "a1", undone: true },
    })
    const markup = renderToStaticMarkup(<AgentRuns view={undone} editing={new Set()} undoRun={undo} />)
    expect(markup).toContain(agentRunsCopy.undone)
    expect(markup.match(/data-agent-run-undo/g)).toHaveLength(1)
  })

  it("says a run edited the deck itself, or a slide that has since been deleted, never a blank", () => {
    const deckNode = [...grown.doom.nodes.values()].find((node) => node.type === "deck")!.id
    const named = landed(grown.doom, {
      once: "n1",
      author: by("codex", "n1", "Codex"),
      writes: [{ node: deckNode, prop: "name", value: "Board" }],
      phase: "start",
    })
    expect(renderToStaticMarkup(<AgentRuns view={named} editing={new Set()} undoRun={undo} />)).toContain(
      "Last edited the deck",
    )
    const gone = landed(deckWithRuns(), {
      once: "d1",
      author: { kind: "person", id: "tab" },
      writes: [{ node: second, prop: "parent", value: null }],
    })
    expect(renderToStaticMarkup(<AgentRuns view={gone} editing={new Set()} undoRun={undo} />)).toContain(
      "Last edited a slide since deleted",
    )
  })

  it("shows nothing on a deck no agent has edited", () => {
    expect(renderToStaticMarkup(<AgentRuns view={grown.doom} editing={new Set()} undoRun={undo} />)).toBe("")
  })
})

describe("the mark on the canvas while an agent edits", () => {
  it("names the agent and says it is on this slide or which other one", () => {
    const fold = deckWithRuns()
    const open = () => undefined
    expect(
      renderToStaticMarkup(<AgentAtWork view={fold} editing={new Set(["c1"])} slide={second} onOpen={open} />),
    ).toContain("Claude Code is editing this slide")
    expect(
      renderToStaticMarkup(<AgentAtWork view={fold} editing={new Set(["c1"])} slide={first} onOpen={open} />),
    ).toContain("Claude Code is editing slide 2")
  })

  it("is gone once the agent has written nothing for a while, though its run is still open", () => {
    const fold = deckWithRuns()
    expect(fold.runs.get("c1")?.phase).toBe("running")
    expect(
      renderToStaticMarkup(<AgentAtWork view={fold} editing={new Set()} slide={first} onOpen={() => undefined} />),
    ).toBe("")
  })

  it("is gone once no agent's run is open", () => {
    const fold = landed(deckWithRuns(), { once: "c1-stop", author: by("claude", "c1"), writes: [], phase: "stop" })
    expect(
      renderToStaticMarkup(
        <AgentAtWork view={fold} editing={new Set(["c1"])} slide={first} onOpen={() => undefined} />,
      ),
    ).toBe("")
  })
})
