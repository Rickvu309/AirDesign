import * as doom from "@airdesign/doom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AgentAtWork } from "./agent-at-work"

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
