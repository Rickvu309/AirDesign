import {
  legacyElement,
  readBox,
  readElementId,
  rootElement,
  type ElementId,
  type Landed,
  type NodeRegister,
  type StoredRegister,
} from "@airdesign/document"

function record(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

function whole(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
}

function nullableWhole(raw: unknown): boolean {
  return raw === null || whole(raw)
}

function element(raw: unknown): raw is ElementId {
  return raw === rootElement || raw === legacyElement || readElementId(raw) !== undefined
}

function rowValue(raw: Record<string, unknown>): boolean {
  if (!Object.hasOwn(raw, "property")) return typeof raw.value === "string"
  return raw.property === "box" && readBox(raw.value) !== null
}

function landed(raw: unknown): raw is Landed {
  return (
    record(raw) &&
    (raw.actor === "person" || raw.actor === "agent") &&
    rowValue(raw) &&
    typeof raw.visible === "boolean" &&
    (raw.runId === undefined || typeof raw.runId === "string")
  )
}

function node(raw: unknown): raw is NodeRegister & Record<string, unknown> {
  return (
    record(raw) &&
    typeof raw.route === "string" &&
    typeof raw.floor === "string" &&
    Array.isArray(raw.landed) &&
    raw.landed.every(landed) &&
    (raw.version === undefined || whole(raw.version)) &&
    (raw.phase === "idle" || raw.phase === "running" || raw.phase === "stopped" || raw.phase === "undone") &&
    (raw.runId === null || typeof raw.runId === "string") &&
    nullableWhole(raw.readAt) &&
    typeof raw.guarded === "boolean" &&
    nullableWhole(raw.claimed) &&
    nullableWhole(raw.stoppedAt) &&
    whole(raw.slides) &&
    whole(raw.bytes)
  )
}

function deck(raw: unknown): raw is Record<string, unknown> {
  return (
    record(raw) &&
    typeof raw.route === "string" &&
    typeof raw.floor === "string" &&
    whole(raw.slides) &&
    whole(raw.bytes) &&
    Array.isArray(raw.nodes) &&
    raw.nodes.every(element) &&
    (raw.readNodes === null || (Array.isArray(raw.readNodes) && raw.readNodes.every(element))) &&
    record(raw.elements) &&
    Object.entries(raw.elements).every(([id, body]) => element(id) && node(body))
  )
}

const rootFields = ["landed", "version", "phase", "runId", "readAt", "guarded", "claimed", "stoppedAt", "b"] as const

export function isRegister(raw: unknown): raw is StoredRegister {
  if (!deck(raw)) return false
  if (!rootFields.some((field) => Object.hasOwn(raw, field))) return true
  return node(raw) && (raw.b === undefined || raw.b === null || node(raw.b))
}
