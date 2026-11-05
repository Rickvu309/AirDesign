import { DatabaseSync } from "node:sqlite"
import { createHash, randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import path from "node:path"

export type OperationId = string & { readonly __brand: "OperationId" }
export function operationId(input: string): OperationId {
  if (!isOperationId(input)) throw new Error("invalid-operation-id")
  return input
}
function isOperationId(value: string): value is OperationId { return /^[a-f0-9-]{36}$/.test(value) }
export type Principal = { personId: string }
export type Operation = { id: OperationId; attempts: number } & (
  { kind: "queued" } | { kind: "running"; lease: string } | { kind: "cancelled" } |
  { kind: "failed"; reason: string } | { kind: "ready"; sha256: string; expires: number; report: Record<string, unknown> } |
  { kind: "expired"; recovery: "submit-again" }
)
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("invalid-operation-row")
  return Object.fromEntries(Object.entries(value))
}
function text(value: unknown): string { if (typeof value !== "string") throw new Error("invalid-operation-field"); return value }
function number(value: unknown): number { if (typeof value !== "number") throw new Error("invalid-operation-field"); return value }

export class OperationStore {
  private db: DatabaseSync
  private clock: () => number
  constructor(filename: string, clock = Date.now) {
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(filename)
    this.clock = clock
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL, input BLOB, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lease TEXT, deadline INTEGER, result BLOB, sha TEXT, expires INTEGER, reason TEXT, report TEXT NOT NULL DEFAULT '{}', holder INTEGER, UNIQUE(owner,request));")
  }
  submit(principal: Principal, request: string, input: Buffer): Operation {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(request)) throw new Error("invalid-request-id")
    const digest = createHash("sha256").update(input).digest("hex")
    this.db.prepare("INSERT INTO operations(id,owner,request,digest,input,state) VALUES(?,?,?,?,?,'queued') ON CONFLICT(owner,request) DO NOTHING").run(randomUUID(), principal.personId, request, digest, input)
    const row = record(this.db.prepare("SELECT * FROM operations WHERE owner=? AND request=?").get(principal.personId, request))
    if (row.digest !== digest) throw new Error("request-id-payload-conflict")
    return this.status(principal, operationId(text(row.id)))
  }
  status(principal: Principal, id: OperationId): Operation {
    const row = this.owned(principal, id)
    const base = { id, attempts: number(row.attempts) }
    switch (row.state) {
      case "queued": return { ...base, kind: "queued" }
      case "running": return { ...base, kind: "running", lease: text(row.lease) }
      case "cancelled": return { ...base, kind: "cancelled" }
      case "failed": return { ...base, kind: "failed", reason: text(row.reason) }
      case "expired": return { ...base, kind: "expired", recovery: "submit-again" }
      case "ready": return { ...base, kind: "ready", sha256: text(row.sha), expires: number(row.expires), report: record(JSON.parse(text(row.report))) }
      default: throw new Error("invalid-operation-state")
    }
  }
  cancel(principal: Principal, id: OperationId): Operation {
    this.owned(principal, id)
    this.db.prepare("UPDATE operations SET state='cancelled',input=NULL,result=NULL WHERE id=? AND owner=? AND state IN ('queued','running')").run(id, principal.personId)
    return this.status(principal, id)
  }
  artifact(principal: Principal, id: OperationId): Buffer {
    const row = this.owned(principal, id)
    if (row.state !== "ready" || !(row.result instanceof Uint8Array)) throw new Error(row.state === "expired" ? "artifact-expired-submit-again" : "artifact-unavailable")
    return Buffer.from(row.result)
  }
  private owned(principal: Principal, id: OperationId): Record<string, unknown> {
    this.expire()
    const row = this.db.prepare("SELECT * FROM operations WHERE id=? AND owner=?").get(id, principal.personId)
    if (!row) throw new Error("operation-not-found")
    return record(row)
  }
  expire(): void {
    this.db.prepare("UPDATE operations SET state='expired',result=NULL,input=NULL WHERE state='ready' AND expires<=?").run(this.clock())
  }
  claim(id: OperationId): { lease: string; input: Buffer; ownerDirectory: string } | null {
    const lease = randomUUID()
    const value = this.db.prepare("UPDATE operations SET state='running',attempts=attempts+1,lease=?,deadline=?,holder=? WHERE id=? AND state='queued' AND lease IS NULL AND attempts<3 RETURNING input,owner").get(lease, this.clock() + 35_000, process.pid, id)
    if (!value) return null
    const row = record(value)
    if (!(row.input instanceof Uint8Array)) throw new Error("missing-input")
    return { lease, input: Buffer.from(row.input), ownerDirectory: createHash("sha256").update(text(row.owner)).digest("hex") }
  }
  complete(id: OperationId, lease: string, result: Buffer, report: Record<string, unknown> = {}): boolean {
    return this.db.prepare("UPDATE operations SET state='ready',result=?,sha=?,expires=?,report=?,input=NULL WHERE id=? AND state='running' AND lease=?").run(result, createHash("sha256").update(result).digest("hex"), this.clock() + 7 * 86_400_000, JSON.stringify(report), id, lease).changes === 1
  }
  fail(id: OperationId, lease: string, reason: string): void {
    this.db.prepare("UPDATE operations SET state='failed',reason=?,input=NULL WHERE id=? AND state='running' AND lease=?").run(reason.slice(0,200), id, lease)
  }
  active(id: OperationId, lease: string): boolean {
    return Boolean(this.db.prepare("SELECT id FROM operations WHERE id=? AND state='running' AND lease=?").get(id, lease))
  }
  recover(): { id: OperationId; lease: string; ownerDirectory: string }[] {
    const recovered: { id: OperationId; lease: string; ownerDirectory: string }[] = []
    for (const value of this.db.prepare("SELECT id,lease,owner,holder,deadline,state FROM operations WHERE lease IS NOT NULL").all()) {
      const row = record(value)
      let alive = true
      try { process.kill(number(row.holder), 0) } catch { alive = false }
      if (row.state === "running" && alive && number(row.deadline) > this.clock()) continue
      const id = operationId(text(row.id))
      const lease = text(row.lease)
      const changed = row.state !== "running"
        ? 1
        : this.db.prepare("UPDATE operations SET state=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END, input=CASE WHEN attempts<3 THEN input ELSE NULL END, reason='worker-retry-exhausted' WHERE id=? AND state='running' AND lease=?").run(id, lease).changes
      if (changed === 1) recovered.push({ id, lease, ownerDirectory: createHash("sha256").update(text(row.owner)).digest("hex") })
    }
    return recovered
  }
  acknowledgeCleanup(id: OperationId, lease: string): void {
    this.db.prepare("UPDATE operations SET lease=NULL,holder=NULL,deadline=NULL WHERE id=? AND lease=? AND state<>'running'").run(id, lease)
  }
  pending(): OperationId[] { return this.db.prepare("SELECT id FROM operations WHERE state='queued'").all().map(row => operationId(text(record(row).id))) }
  close(): void { this.db.close() }
}
