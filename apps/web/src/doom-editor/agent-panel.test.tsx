import { readDeckId } from "@airdesign/catalog"
import { emptyDoom } from "@airdesign/doom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { airaCopy } from "@/copy/aira-copy"
import { AgentPanel } from "./agent-panel"

const named = readDeckId("deck-1")
if (!named.ok) throw new Error("deck id")
const deck = {
  deck: named.deck,
  view: () => emptyDoom,
  undoRun: async () => ({ ok: false, reason: "nothing" }) as const,
}

describe("the Agent side of the Doom editor", () => {
  it("is today's Aira panel: the empty state and the Ask Aira composer, with no column of its own", () => {
    const markup = renderToStaticMarkup(<AgentPanel deck={deck} view={emptyDoom} />)
    expect(markup).toContain("data-aira-panel")
    expect(markup).toContain("data-aira-welcome")
    expect(markup).toContain(airaCopy.askAira)
    expect(markup).not.toContain("<aside")
  })
})
