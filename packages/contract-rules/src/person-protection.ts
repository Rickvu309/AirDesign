import { asRunId, type RunId } from "./brand.ts"

export type ProtectionProperty = string

export type PersonEditEvent = {
  type: "person-edit"
  at: number
  property: ProtectionProperty
  value: string
}

export type AgentWriteEvent = {
  type: "agent-write"
  at: number
  runId: RunId
  runStartedAt: number
  property: ProtectionProperty
  value: string
}

export type ProtectionEvent = PersonEditEvent | AgentWriteEvent

export type PropertyState = {
  value: string
  protectedSince: number | null
}

export type ProtectionOutcome =
  | { outcome: "applied"; property: ProtectionProperty; value: string }
  | { outcome: "refused"; property: ProtectionProperty; value: string; reason: "older-run" }

const nodeProperty = new RegExp("^node:([^/]+)/")

export function protectionKey(property: ProtectionProperty): string {
  const match = nodeProperty.exec(property)
  const nodeId = match?.[1]
  if (nodeId) {
    return `node:${nodeId}`
  }
  return property
}

export function initialPropertyState(property: ProtectionProperty): PropertyState {
  if (property.endsWith("/existence")) {
    return { value: "present", protectedSince: null }
  }
  return { value: "", protectedSince: null }
}

export function applyProtectionEvent(
  states: ReadonlyMap<string, PropertyState>,
  event: ProtectionEvent,
): { states: Map<string, PropertyState>; outcome: ProtectionOutcome } {
  const next = new Map(states)
  const key = protectionKey(event.property)
  const current = next.get(event.property) ?? initialPropertyState(event.property)
  if (event.type === "person-edit") {
    const value = event.value
    next.set(event.property, { value, protectedSince: event.at })
    const guarded = next.get(key)
    const guardedSince = guarded?.protectedSince ?? null
    const since = guardedSince === null ? event.at : Math.min(guardedSince, event.at)
    next.set(key, { value: guarded?.value ?? "present", protectedSince: since })
    return { states: next, outcome: { outcome: "applied", property: event.property, value } }
  }
  const guard = next.get(key)
  const blocked = guard?.protectedSince !== null && guard?.protectedSince !== undefined && event.runStartedAt < guard.protectedSince
  if (blocked) {
    return {
      states: next,
      outcome: { outcome: "refused", property: event.property, value: current.value, reason: "older-run" },
    }
  }
  next.set(event.property, { value: event.value, protectedSince: current.protectedSince })
  return { states: next, outcome: { outcome: "applied", property: event.property, value: event.value } }
}

export function replayProtection(events: readonly ProtectionEvent[]): ProtectionOutcome {
  let states = new Map<string, PropertyState>()
  let outcome: ProtectionOutcome = { outcome: "applied", property: "", value: "" }
  for (const event of events) {
    const step = applyProtectionEvent(states, event)
    states = step.states
    outcome = step.outcome
  }
  return outcome
}

export function parseProtectionEvent(value: unknown): ProtectionEvent {
  if (!value || typeof value !== "object") {
    throw new Error("protection-event")
  }
  const event = value as Record<string, unknown>
  if (event.type === "person-edit" && typeof event.at === "number" && typeof event.property === "string" && typeof event.value === "string") {
    return { type: "person-edit", at: event.at, property: event.property, value: event.value }
  }
  if (
    event.type === "agent-write" &&
    typeof event.at === "number" &&
    typeof event.runId === "string" &&
    typeof event.runStartedAt === "number" &&
    typeof event.property === "string" &&
    typeof event.value === "string"
  ) {
    return {
      type: "agent-write",
      at: event.at,
      runId: asRunId(event.runId),
      runStartedAt: event.runStartedAt,
      property: event.property,
      value: event.value,
    }
  }
  throw new Error("protection-event")
}
