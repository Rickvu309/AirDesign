import { registerScope, type ElementId } from "@airdesign/document"
import { call, type Deck } from "@airdesign/engine"

export function answered(result: ReturnType<typeof call>, said: string): Deck {
  if (!result.ok) throw new Error(`${said} refused ${result.refusal}`)
  return result.deck
}

export function agentSet(server: Deck, at: ElementId, change: object): Deck {
  const deck = server.id
  const runId = `agent-${server.revision}`
  const caller = { actor: "agent", runId } as const
  const nodes = registerScope(server.register).expand({ node: at })
  if (nodes === "indexing") throw new Error("indexing")
  const started = answered(
    call("start_run", server, caller, { deck, runId, elements: nodes.map((node) => ({ node })) }),
    "start",
  )
  const base = started.revision
  const edited = answered(call("edit_deck", started, caller, { deck, base, changes: [change] }), "the agent's set")
  return answered(call("stop_run", edited, caller, { deck, runId }), "stop")
}
