import { readAgentEdit, type WireChange } from "@airdesign/catalog"
import { decide, type Decision, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import type { AgentCaller, ToolResult } from "./call-tool.js"

export function agentCaller(runId: string): AgentCaller {
  return { actor: "agent", runId }
}

function runningId(register: Register): string | undefined {
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body !== undefined && body.phase === "running" && body.runId !== null) return body.runId
  }
  return undefined
}

function openedElement(register: Register, change: WireChange): Decision {
  if (register.nodes.includes(change.node)) return { decision: "apply", register, route: register.route }
  return decide(register, {
    command: "add",
    node: change.node,
    floor: change.floor ?? register.floor,
    route: register.route,
  })
}

export function openRun(
  register: Register,
  raw: unknown,
  mint: () => string,
):
  | { readonly ok: true; readonly register: Register; readonly caller: AgentCaller }
  | { readonly ok: false; readonly refusal: string } {
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return { ok: false, refusal: parsed.refusal }
  let next = register
  let minted: string | undefined
  const take = (): string => {
    const existing = runningId(next)
    if (existing !== undefined) return existing
    minted ??= mint()
    return minted
  }
  for (const change of parsed.changes) {
    const opened = openedElement(next, change)
    if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
    next = opened.register
    if (next.elements[change.node]?.phase === "running") continue
    const started = decide(next, { command: "start", runId: take(), node: change.node })
    if (started.decision === "refuse") return { ok: false, refusal: started.code }
    next = started.register
  }
  return { ok: true, register: next, caller: agentCaller(take()) }
}

export function afterWrite(wrote: boolean, result: ToolResult, loaded: Deck): ToolResult {
  if (!result.ok || wrote) return result
  return { ok: false, refusal: "stale", deck: loaded, content: [{ type: "text", text: "stale" }] }
}
