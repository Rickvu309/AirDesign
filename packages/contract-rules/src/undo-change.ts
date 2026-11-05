export type ChangeActor = "person" | "agent"
export type ChangeStatus = "applied" | "refused"

export type AppliedChange = {
  id: string
  actor: ChangeActor
  property: string
  payload: string
  prior: string
  status: ChangeStatus
}

export type ChangeLog = {
  applied: AppliedChange[]
  undone: AppliedChange[]
  superseded: string[]
  values: Record<string, string>
}

export function emptyChangeLog(values: Record<string, string> = {}): ChangeLog {
  return { applied: [], undone: [], superseded: [], values }
}

export function applyChange(log: ChangeLog, change: AppliedChange): ChangeLog {
  if (change.status === "refused") {
    return { ...log, applied: [...log.applied, change] }
  }
  const dropped = log.undone.filter((item) => item.property === change.property)
  return {
    applied: [...log.applied, change],
    undone: log.undone.filter((item) => item.property !== change.property),
    superseded: [...log.superseded, ...dropped.map((item) => item.id)],
    values: { ...log.values, [change.property]: change.payload },
  }
}

export type UndoChangeResult =
  | { outcome: "applied"; restored: string; log: ChangeLog }
  | { outcome: "refused"; reason: "unknown-change" | "payload-mismatch" | "skipped-refusal"; log: ChangeLog }

export function undoChange(log: ChangeLog, request: { id: string; payload: string }): UndoChangeResult {
  const found = log.applied.find((item) => item.id === request.id)
  if (!found) {
    return { outcome: "refused", reason: "unknown-change", log }
  }
  if (found.payload !== request.payload) {
    return { outcome: "refused", reason: "payload-mismatch", log }
  }
  if (found.status === "refused") {
    return { outcome: "refused", reason: "skipped-refusal", log }
  }
  return {
    outcome: "applied",
    restored: found.prior,
    log: {
      ...log,
      values: { ...log.values, [found.property]: found.prior },
      undone: [found, ...log.undone.filter((item) => item.id !== found.id)],
    },
  }
}

export type RedoChangeResult =
  | { outcome: "applied"; log: ChangeLog }
  | { outcome: "refused"; reason: "redo-invalid" | "unknown-change" | "payload-mismatch"; log: ChangeLog }

export function redoChange(log: ChangeLog, request: { id: string; payload: string }): RedoChangeResult {
  if (log.superseded.includes(request.id)) {
    return { outcome: "refused", reason: "redo-invalid", log }
  }
  const found = log.undone.find((item) => item.id === request.id)
  if (!found) {
    return { outcome: "refused", reason: "unknown-change", log }
  }
  if (found.payload !== request.payload) {
    return { outcome: "refused", reason: "payload-mismatch", log }
  }
  if (log.values[found.property] !== found.prior) {
    return { outcome: "refused", reason: "redo-invalid", log }
  }
  return {
    outcome: "applied",
    log: {
      ...log,
      values: { ...log.values, [found.property]: found.payload },
      undone: log.undone.filter((item) => item.id !== found.id),
    },
  }
}

export function parseAppliedChange(value: unknown): AppliedChange {
  if (!value || typeof value !== "object") {
    throw new Error("change")
  }
  const change = value as Record<string, unknown>
  if (
    typeof change.id !== "string" ||
    (change.actor !== "person" && change.actor !== "agent") ||
    typeof change.property !== "string" ||
    typeof change.payload !== "string" ||
    typeof change.prior !== "string" ||
    (change.status !== "applied" && change.status !== "refused")
  ) {
    throw new Error("change")
  }
  return {
    id: change.id,
    actor: change.actor,
    property: change.property,
    payload: change.payload,
    prior: change.prior,
    status: change.status,
  }
}
