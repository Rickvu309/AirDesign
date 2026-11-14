import {
  legacyElement,
  newerFormat,
  readElementId,
  readRow,
  readSlideState,
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

function newerRow(raw: unknown): boolean {
  const read = readRow(raw, "text")
  return !read.ok && read.refusal === "newer"
}

function holdsNewerRow(raw: unknown): boolean {
  if (!record(raw) || !record(raw.elements)) return false
  return Object.values(raw.elements).some(
    (body) => record(body) && Array.isArray(body.landed) && body.landed.some(newerRow),
  )
}

function landed(raw: unknown): raw is Landed {
  return (
    record(raw) &&
    (raw.actor === "person" || raw.actor === "agent") &&
    readRow(raw, "text").ok &&
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
    Object.entries(raw.elements).every(([id, body]) => element(id) && node(body)) &&
    (raw.ended === undefined || (Array.isArray(raw.ended) && raw.ended.every((runId) => typeof runId === "string"))) &&
    (raw.lastRun === undefined || lastRun(raw.lastRun))
  )
}

function lastRun(raw: unknown): boolean {
  return record(raw) && typeof raw.runId === "string" && whole(raw.since) && whole(raw.revision)
}

const rootFields = ["landed", "version", "phase", "runId", "readAt", "guarded", "claimed", "stoppedAt", "b"] as const

function slideFields(raw: Record<string, unknown>): boolean {
  if (!Object.hasOwn(raw, "file") && !Object.hasOwn(raw, "order")) return true
  return (
    readSlideState({
      file: Object.hasOwn(raw, "file") ? raw.file : [],
      order: Object.hasOwn(raw, "order") ? raw.order : [],
    }) !== undefined
  )
}

export type RegisterRead =
  | { readonly ok: true; readonly register: StoredRegister }
  | { readonly ok: false; readonly refusal: "newer" | "payload" }

export function readRegister(raw: unknown): RegisterRead {
  if (newerFormat(raw) || holdsNewerRow(raw)) return { ok: false, refusal: "newer" }
  return isRegister(raw) ? { ok: true, register: raw } : { ok: false, refusal: "payload" }
}

function isRegister(raw: unknown): raw is StoredRegister {
  if (!deck(raw) || !slideFields(raw)) return false
  if (!rootFields.some((field) => Object.hasOwn(raw, field))) return true
  return node(raw) && (raw.b === undefined || raw.b === null || node(raw.b))
}
