import { readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { airaCopy } from "@/copy/aira-copy"
import { AgentPanel } from "./agent-panel"

const named = readDeckId("deck-1")
if (!named.ok) throw new Error("deck id")
const deck = {
  deck: named.deck,
  view: () => doom.emptyDoom,
  undoRun: async () => ({ ok: false, reason: "nothing" }) as const,
}

describe("the Agent side of the Doom editor", () => {
  it("is today's Aira panel: the empty state and the Ask Aira composer, with no column of its own", () => {
    const markup = renderToStaticMarkup(<AgentPanel deck={deck} view={doom.emptyDoom} />)
    expect(markup).toContain("data-aira-panel")
    expect(markup).toContain("data-aira-welcome")
    expect(markup).toContain(airaCopy.askAira)
    expect(markup).not.toContain("<aside")
  })

  it("shows no list of the agents that edited the deck, only Aira's chat", () => {
    const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [{ type: "shape" }] }] })
    const [slide] = grown.slides as [doom.NodeId]
    const edited = doom.applyEdit(grown.doom, {
      once: "c1",
      rev: doom.rev(grown.doom.rev + 1),
      author: { kind: "agent", id: "claude", run: "c1", name: "Claude Code" },
      writes: [{ node: grown.doom.children.get(slide)![0]!, prop: "name", value: "C" }],
      phase: "start",
    })
    if (doom.isRefusal(edited)) throw new Error(edited.refused)
    const markup = renderToStaticMarkup(<AgentPanel deck={{ ...deck, view: () => edited }} view={edited} />)
    expect(markup).not.toContain("Claude Code")
    expect(markup).toContain("data-aira-welcome")
  })
})
