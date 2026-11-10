import { readAgentEdit } from "@airdesign/catalog"
import { decide, elementId, version, type ElementId, type NodeRegister, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import type { AgentCaller, ToolResult } from "./call-tool.js"

const openedElement = elementId("a")

export function agentCaller(runId: string, readAt: number): AgentCaller {
  return { actor: "agent", runId, readAt }
}

function bodyOf(register: Register, node: ElementId | undefined): NodeRegister | undefined {
  if (node === undefined || node === openedElement) return register
  return register.elements[node]
}

export function readAtFor(register: Register, node: ElementId | undefined): number {
  return version(bodyOf(register, node) ?? register)
}

function runningId(register: Register): string | undefined {
  if (register.phase === "running" && register.runId !== null) return register.runId
  for (const id of register.nodes) {
    if (id === openedElement) continue
    const body = register.elements[id]
    if (body !== undefined && body.phase === "running" && body.runId !== null) return body.runId
  }
  return undefined
}

function startCommand(node: ElementId | undefined, runId: string) {
  if (node === undefined) return { command: "start" as const, runId }
  return { command: "start" as const, runId, node }
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
    const body = bodyOf(next, change.node)
    if (body !== undefined && body.phase === "running") continue
    const started = decide(next, startCommand(change.node, take()))
    if (started.decision === "refuse") return { ok: false, refusal: started.code }
    next = started.register
  }
  const node = parsed.changes[0]?.node
  const body = bodyOf(next, node)
  const runId = body?.phase === "running" && body.runId !== null ? body.runId : take()
  return { ok: true, register: next, caller: agentCaller(runId, readAtFor(next, node)) }
}

export function afterWrite(wrote: boolean, result: ToolResult, loaded: Deck): ToolResult {
  if (!result.ok || wrote) return result
  return { ok: false, refusal: "stale", deck: loaded, content: [{ type: "text", text: "stale" }] }
}
