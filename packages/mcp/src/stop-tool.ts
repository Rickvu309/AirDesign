import { readNamedDeck, readRun } from "@airdesign/catalog"

import { answered, hostRefused, refused, type ToolResult } from "./answer.js"
import type { DeckHost } from "./deck-host.js"

export async function stopRunTool(raw: unknown, agent: string, once: string, host: DeckHost): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readRun(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const run = opened.fold.runs.get(parsed.runId)
  if (run === undefined) return refused("run-fenced", { rev: opened.rev })
  if (run.phase === "stopped")
    return answered("That run had already stopped.", {
      ok: true,
      deck: opened.deck,
      rev: opened.rev,
      runId: parsed.runId,
    })
  const landed = await host.edit(parsed.deck, {
    once,
    author: { kind: "agent", id: agent, run: parsed.runId },
    writes: [],
    phase: "stop",
  })
  if (!landed.ok) return hostRefused(landed)
  return answered("The run has stopped.", { ok: true, deck: landed.deck, rev: landed.rev, runId: parsed.runId })
}
