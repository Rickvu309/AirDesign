import { applyChange, emptyChangeLog, parseAppliedChange, redoChange, undoChange, type ChangeLog } from "./undo-change.ts"
import { parseProtectionEvent, replayProtection } from "./person-protection.ts"
import { parseRunUndoCase, undoRun } from "./run-undo.ts"

export type CaseExpect = Record<string, unknown>

export function evaluateContractCase(contractId: string, body: unknown, expect: CaseExpect): { pass: boolean; actual: unknown } {
  switch (contractId) {
    case "C01":
      return evaluateProtection(body, expect)
    case "C02":
      return evaluateUndoRun(body, expect)
    case "C03":
      return evaluateUndoChange(body, expect)
    default:
      return { pass: false, actual: { error: "no-executable-rule", contractId } }
  }
}

function evaluateProtection(body: unknown, expect: CaseExpect): { pass: boolean; actual: unknown } {
  if (!body || typeof body !== "object" || !Array.isArray((body as { events?: unknown }).events)) {
    return { pass: false, actual: { error: "events" } }
  }
  const events = (body as { events: unknown[] }).events.map(parseProtectionEvent)
  const actual = replayProtection(events)
  const pass = actual.outcome === expect.outcome && actual.value === expect.value && (expect.property === undefined || actual.property === expect.property)
  return { pass, actual }
}

function evaluateUndoRun(body: unknown, expect: CaseExpect): { pass: boolean; actual: unknown } {
  const actual = undoRun(parseRunUndoCase(body))
  const adopted = expect.adopted as { id: string; parentId: string | null; text: string }[]
  const absent = expect.absentIds as string[]
  const present = expect.presentIds as string[]
  const adoptedPass = JSON.stringify(actual.adopted) === JSON.stringify(adopted)
  const absentPass = absent.every((id) => !actual.nodes.some((node) => node.id === id))
  const presentPass = present.every((id) => actual.nodes.some((node) => node.id === id))
  return { pass: adoptedPass && absentPass && presentPass, actual }
}

function evaluateUndoChange(body: unknown, expect: CaseExpect): { pass: boolean; actual: unknown } {
  if (!body || typeof body !== "object") {
    return { pass: false, actual: { error: "body" } }
  }
  const record = body as { steps?: unknown }
  if (!Array.isArray(record.steps)) {
    return { pass: false, actual: { error: "steps" } }
  }
  let log = emptyChangeLog()
  let actual: unknown = null
  for (const step of record.steps) {
    const played = playChangeStep(log, step)
    log = played.log
    actual = played.actual
  }
  const pass = JSON.stringify(actual) === JSON.stringify(expect)
  return { pass, actual }
}

function playChangeStep(log: ChangeLog, step: unknown): { log: ChangeLog; actual: unknown } {
  if (!step || typeof step !== "object") {
    throw new Error("step")
  }
  const record = step as Record<string, unknown>
  if (record.op === "apply") {
    const next = applyChange(log, parseAppliedChange(record.change))
    return { log: next, actual: { outcome: "applied", value: next.values } }
  }
  if (record.op === "undo") {
    const result = undoChange(log, { id: String(record.id), payload: String(record.payload) })
    return { log: result.log, actual: result.outcome === "applied" ? { outcome: "applied", restored: result.restored, values: result.log.values } : { outcome: "refused", reason: result.reason, values: result.log.values } }
  }
  if (record.op === "redo") {
    const result = redoChange(log, { id: String(record.id), payload: String(record.payload) })
    return { log: result.log, actual: result.outcome === "applied" ? { outcome: "applied", values: result.log.values } : { outcome: "refused", reason: result.reason, values: result.log.values } }
  }
  throw new Error("step-op")
}
