import {importSlideProgressSchema,runningProgressSchema,type ImportSlideProgress,type RunningProgress} from "./import-progress.ts"
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
  { kind: "queued" } | { kind: "running"; lease: string; progress: RunningProgress } | { kind: "cancelled" } |
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
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL, input BLOB, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lease TEXT, deadline INTEGER, result BLOB, sha TEXT, expires INTEGER, reason TEXT, report TEXT NOT NULL DEFAULT '{}', holder INTEGER, UNIQUE(owner,request)); CREATE INDEX IF NOT EXISTS operations_expiry ON operations(state,expires);")
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const columns=this.db.prepare("PRAGMA table_info(operations)").all().map(row=>row.name)
      if(!columns.includes("progress_completed"))this.db.exec("ALTER TABLE operations ADD COLUMN progress_completed INTEGER")
      if(!columns.includes("progress_total"))this.db.exec("ALTER TABLE operations ADD COLUMN progress_total INTEGER")
      this.db.exec("CREATE TABLE IF NOT EXISTS import_finalization (id TEXT PRIMARY KEY, lease TEXT, result BLOB, report TEXT)")
      this.db.exec("COMMIT")
    } catch(error) {this.db.exec("ROLLBACK");throw error}
  }
  submit(principal: Principal, request: string, input: Buffer, finalizeImport=false): Operation {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(request)) throw new Error("invalid-request-id")
    const digest = createHash("sha256").update(input).digest("hex")
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.db.prepare("INSERT INTO operations(id,owner,request,digest,input,state) VALUES(?,?,?,?,?,'queued') ON CONFLICT(owner,request) DO NOTHING").run(randomUUID(), principal.personId, request, digest, input)
      const row = record(this.db.prepare("SELECT id,digest FROM operations WHERE owner=? AND request=?").get(principal.personId, request))
      if (row.digest !== digest) throw new Error("request-id-payload-conflict")
      const id=operationId(text(row.id))
      if(finalizeImport)this.db.prepare("INSERT INTO import_finalization(id) VALUES(?) ON CONFLICT(id) DO NOTHING").run(id)
      this.db.exec("COMMIT")
      return this.status(principal,id)
    } catch(error){this.db.exec("ROLLBACK");throw error}
  }
  request(principal:Principal,id:OperationId):string {
    this.owned(principal,id)
    return text(record(this.db.prepare("SELECT request FROM operations WHERE id=? AND owner=?").get(id,principal.personId)).request)
  }
  requiresFinalization(id:OperationId):boolean {return !!this.db.prepare("SELECT id FROM import_finalization WHERE id=?").get(id)}
  stage(id:OperationId,lease:string,result:Buffer,report:Record<string,unknown>):boolean {
    return this.db.prepare("UPDATE import_finalization SET lease=?,result=?,report=? WHERE id=? AND result IS NULL AND EXISTS(SELECT 1 FROM operations WHERE id=? AND state='running' AND lease=? AND deadline>?)").run(lease,result,JSON.stringify(report),id,id,lease,this.clock()).changes===1
  }
  finalizations() {
    return this.db.prepare("SELECT o.id,o.owner,o.request,o.state,o.result AS legacy_result,o.report AS legacy_report,f.lease,f.result,f.report FROM operations o LEFT JOIN import_finalization f ON f.id=o.id WHERE (o.state='running' AND f.result IS NOT NULL) OR (o.state='ready' AND o.expires>? AND (f.id IS NULL OR f.result IS NOT NULL OR f.lease IS NULL))").all(this.clock()).flatMap(value=>{
      const row=record(value),legacy=row.state==="ready",bytes=legacy ? row.legacy_result : row.result
      const report=record(JSON.parse(text(legacy ? row.legacy_report : row.report)))
      if(!(bytes instanceof Uint8Array)||!('deck' in report))return []
      return [{id:operationId(text(row.id)),principal:{personId:text(row.owner)},request:text(row.request),bytes:Buffer.from(bytes),report,publication:legacy ? {kind:"legacy" as const} : {kind:"staged" as const,lease:text(row.lease)}}]
    })
  }
  reconciled(id:OperationId):void {
    this.db.prepare("INSERT INTO import_finalization(id,lease) VALUES(?,'legacy') ON CONFLICT(id) DO UPDATE SET result=NULL,report=NULL,lease=COALESCE(import_finalization.lease,'legacy')").run(id)
  }
  completed(id:OperationId,lease:string):boolean {return !!this.db.prepare("SELECT o.id FROM operations o JOIN import_finalization f ON f.id=o.id WHERE o.id=? AND o.state='ready' AND f.lease=?").get(id,lease)}
  publish(id:OperationId,lease:string):boolean {
    this.db.exec("BEGIN IMMEDIATE")
    try{
      const published=this.completed(id,lease)||this.db.prepare("UPDATE operations SET state='ready',result=(SELECT result FROM import_finalization WHERE id=?),report=(SELECT report FROM import_finalization WHERE id=?),sha=?,expires=?,input=NULL WHERE id=? AND state='running' AND lease=? AND EXISTS(SELECT 1 FROM import_finalization WHERE id=? AND lease=? AND result IS NOT NULL)").run(id,id,this.stagedHash(id),this.clock()+7*86_400_000,id,lease,id,lease).changes===1
      this.db.exec("COMMIT")
      return published
    }catch(error){this.db.exec("ROLLBACK");throw error}
  }
  private stagedHash(id:OperationId):string {
    const bytes=record(this.db.prepare("SELECT result FROM import_finalization WHERE id=?").get(id)).result
    if(!(bytes instanceof Uint8Array))throw new Error("missing-finalization")
    return createHash("sha256").update(bytes).digest("hex")
  }

  status(principal: Principal, id: OperationId): Operation {
    const row = this.owned(principal, id)
    const base = { id, attempts: number(row.attempts) }
    switch (row.state) {
      case "queued": return { ...base, kind: "queued" }
      case "running": return { ...base, kind: "running", lease: text(row.lease), progress: runningProgressSchema.parse(row.progress_total===null ? {kind:"unavailable"} : {kind:"import-slides",completed:row.progress_completed,total:row.progress_total}) }
      case "cancelled": return { ...base, kind: "cancelled" }
      case "failed": return { ...base, kind: "failed", reason: text(row.reason) }
      case "expired": return { ...base, kind: "expired", recovery: "submit-again" }
      case "ready": if(number(row.expires)<=this.clock())return {...base,kind:"expired",recovery:"submit-again"};return { ...base, kind: "ready", sha256: text(row.sha), expires: number(row.expires), report: record(JSON.parse(text(row.report))) }
      default: throw new Error("invalid-operation-state")
    }
  }
  cancel(principal: Principal, id: OperationId): Operation {
    this.owned(principal, id)
    this.db.prepare("UPDATE operations SET state='cancelled',input=NULL,result=NULL WHERE id=? AND owner=? AND state IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM import_finalization f WHERE f.id=operations.id AND f.result IS NOT NULL)").run(id, principal.personId)
    return this.status(principal, id)
  }
  artifact(principal: Principal, id: OperationId): Buffer {
    const row = this.owned(principal, id,true)
    if(row.state==="ready"&&number(row.expires)<=this.clock())throw new Error("artifact-expired-submit-again")
    if (row.state !== "ready" || !(row.result instanceof Uint8Array)) throw new Error(row.state === "expired" ? "artifact-expired-submit-again" : "artifact-unavailable")
    return Buffer.from(row.result)
  }
  private owned(principal: Principal, id: OperationId, artifact=false): Record<string, unknown> {
    const row = this.db.prepare(`SELECT id,owner,state,attempts,lease,reason,sha,expires,report,progress_completed,progress_total${artifact ? ",result" : ""} FROM operations WHERE id=? AND owner=?`).get(id, principal.personId)
    if (!row) throw new Error("operation-not-found")
    return record(row)
  }
  expire(): void {
    this.db.prepare("UPDATE operations SET state='expired',result=NULL,input=NULL WHERE state='ready' AND expires<=?").run(this.clock())
  }
  claim(id: OperationId): { lease: string; input: Buffer; ownerDirectory: string } | null {
    const lease = randomUUID()
    const value = this.db.prepare("UPDATE operations SET state='running',progress_completed=NULL,progress_total=NULL,attempts=attempts+1,lease=?,deadline=?,holder=? WHERE id=? AND state='queued' AND lease IS NULL AND attempts<3 RETURNING input,owner").get(lease, this.clock() + 35_000, process.pid, id)
    if (!value) return null
    const row = record(value)
    if (!(row.input instanceof Uint8Array)) throw new Error("missing-input")
    return { lease, input: Buffer.from(row.input), ownerDirectory: createHash("sha256").update(text(row.owner)).digest("hex") }
  }
  recordProgress(id:OperationId,lease:string,value:ImportSlideProgress):boolean {
    const parsed=importSlideProgressSchema.safeParse(value)
    if(!parsed.success)return false
    const {completed,total}=parsed.data
    return this.db.prepare("UPDATE operations SET progress_completed=?,progress_total=? WHERE id=? AND state='running' AND lease=? AND (progress_total IS NULL OR (progress_total=? AND progress_completed<=?))").run(completed,total,id,lease,total,completed).changes===1
  }
  complete(id: OperationId, lease: string, result: Buffer, report: Record<string, unknown> = {}): boolean {
    return this.db.prepare("UPDATE operations SET state='ready',result=?,sha=?,expires=?,report=?,input=NULL WHERE id=? AND state='running' AND lease=? AND deadline> ? AND NOT EXISTS(SELECT 1 FROM import_finalization f WHERE f.id=operations.id)").run(result, createHash("sha256").update(result).digest("hex"), this.clock() + 7 * 86_400_000, JSON.stringify(report), id, lease,this.clock()).changes === 1
  }
  fail(id: OperationId, lease: string, reason: string): void {
    this.db.prepare("UPDATE operations SET state='failed',reason=?,input=NULL WHERE id=? AND state='running' AND lease=? AND NOT EXISTS(SELECT 1 FROM import_finalization f WHERE f.id=operations.id AND f.result IS NOT NULL)").run(reason.slice(0,200), id, lease)
  }
  active(id: OperationId, lease: string): boolean {
    return Boolean(this.db.prepare("SELECT id FROM operations WHERE id=? AND state='running' AND lease=? AND deadline>? AND NOT EXISTS(SELECT 1 FROM import_finalization f WHERE f.id=operations.id AND f.result IS NOT NULL)").get(id, lease,this.clock()))
  }
  recover(): { id: OperationId; lease: string; ownerDirectory: string }[] {
    const recovered: { id: OperationId; lease: string; ownerDirectory: string }[] = []
    for (const value of this.db.prepare("SELECT id,lease,owner,holder,deadline,state FROM operations WHERE lease IS NOT NULL").all()) {
      const row = record(value)
      let alive = true
      try { process.kill(number(row.holder), 0) } catch { alive = false }
      if(this.db.prepare("SELECT id FROM import_finalization WHERE id=? AND result IS NOT NULL").get(text(row.id)) && row.state==="running")continue
      if (row.state === "running" && alive && number(row.deadline) > this.clock()) continue
      const id = operationId(text(row.id))
      const lease = text(row.lease)
      const changed = row.state !== "running"
        ? 1
        : this.db.prepare("UPDATE operations SET state=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END, input=CASE WHEN attempts<3 THEN input ELSE NULL END, reason='worker-retry-exhausted' WHERE id=? AND state='running' AND lease=? AND NOT EXISTS(SELECT 1 FROM import_finalization f WHERE f.id=operations.id AND f.result IS NOT NULL)").run(id, lease).changes
      if (changed === 1) recovered.push({ id, lease, ownerDirectory: createHash("sha256").update(text(row.owner)).digest("hex") })
    }
    return recovered
  }
  acknowledgeCleanup(id: OperationId, lease: string): void {
    this.db.prepare("UPDATE operations SET lease=NULL,holder=NULL,deadline=NULL WHERE id=? AND lease=? AND state<>'running'").run(id, lease)
  }
  pending(): OperationId[] { return this.db.prepare("SELECT id FROM operations WHERE state='queued'").all().map(row => operationId(text(record(row).id))) }
  ownerRunning(owner:string):boolean {return !!this.db.prepare("SELECT id FROM operations WHERE owner=? AND (state='running' OR lease IS NOT NULL) LIMIT 1").get(owner)}
  deleteOwner(owner:string):void {
    if(this.db.prepare("SELECT id FROM operations WHERE owner=? AND (state='running' OR lease IS NOT NULL) LIMIT 1").get(owner))throw new Error("account-operation-still-running")
    this.db.prepare("DELETE FROM import_finalization WHERE id IN (SELECT id FROM operations WHERE owner=?)").run(owner)
    this.db.prepare("DELETE FROM operations WHERE owner=?").run(owner)
  }
  close(): void { this.db.close() }
}
