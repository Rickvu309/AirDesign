import { execute, initialHistory, type Command, type Receipt } from "../../change-log/src/index.ts"
import { parseDeck, type Deck } from "../../deck/src/index.ts"
import { outboxKey, type Outbox, type Pending } from "./outbox.ts"
export type SyncState = {kind:"saved"} | {kind:"pending";count:number} | {kind:"offline";count:number} | {kind:"retrying";count:number} | {kind:"signed-out";count:number} | {kind:"deleted";count:number} | {kind:"recovery";count:number}
export type Snapshot = {deck:Deck;seq:number}
export function parseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object" || !("deck" in value) || !("seq" in value) || typeof value.seq !== "number" || !Number.isSafeInteger(value.seq) || value.seq < 0) throw new Error("invalid-snapshot")
  return {deck:parseDeck(value.deck),seq:value.seq}
}
export class SyncClient {
  readonly key: string
  readonly outbox: Outbox
  private snapshot: Snapshot
  private pending: Pending[] = []
  private online = false
  private blocked: "signed-out" | "deleted" | null = null
  private retrying = false
  private work: Promise<void> = Promise.resolve()
  private sender: ((command: Command)=>void) | null = null
  private sent = new Set<string>()
  private durable = new Set<string>()
  private projected: Deck | null = null
  private changed: ()=>void
  constructor(person: string, snapshot: Snapshot, outbox: Outbox, changed: ()=>void) { this.key=outboxKey(person,snapshot.deck.id);this.snapshot=snapshot;this.outbox=outbox;this.changed=changed }
  async load() { this.pending=await this.outbox.read(this.key);this.durable=new Set(this.pending.map(item=>item.command.id));this.notify() }
  get seq() { return this.snapshot.seq }
  get queue() { return structuredClone(this.pending) }
  get deck(): Deck {
    if (this.projected) return this.projected
    let deck = this.snapshot.deck
    for (const item of this.pending) if (item.kind === "queued" && (item.command.kind === "patch" || item.command.kind === "edit") && item.command.run === null) deck = execute(initialHistory(deck),item.command).history.deck
    this.projected=deck
    return deck
  }
  get state(): SyncState {
    const count=this.pending.length
    if (this.blocked) return {kind:this.blocked,count}
    if (this.pending.some(p=>p.kind==="rejected")) return {kind:"recovery",count}
    if (!this.online) return {kind:this.retrying ? "retrying" : "offline",count}
    return count ? {kind:"pending",count} : {kind:"saved"}
  }
  connected(sender: (command: Command)=>void) { if (this.blocked) return;this.sender=sender;this.online=true;this.retrying=false;this.flush();this.changed() }
  disconnected(retrying=false) { this.online=false;this.sender=null;this.sent.clear();this.retrying=retrying;this.changed() }
  stop(kind: "signed-out" | "deleted") { this.blocked=kind;this.disconnected() }
  resume(person: string) { if (this.key !== outboxKey(person,this.snapshot.deck.id) || this.blocked === "deleted") return false;this.blocked=null;return true }
  receive(snapshot: Snapshot) { if (snapshot.deck.id !== this.snapshot.deck.id || snapshot.seq < this.snapshot.seq) return;this.snapshot=structuredClone(snapshot);this.notify() }
  enqueue(command: Command): Promise<void> {
    if (this.blocked) return Promise.reject(new Error(this.blocked))
    if (this.pending.some(p=>p.command.id===command.id)) return Promise.reject(new Error("pending-id-reused"))
    this.pending=[...this.pending,{kind:"queued",command:structuredClone(command)}]
    this.notify()
    return this.persist()
  }
  acknowledge(receipt: Receipt): Promise<void> {
    this.pending=this.pending.flatMap(item=>item.command.id!==receipt.id ? [item] : receipt.kind==="applied" ? [] : [{kind:"rejected",command:item.command,code:receipt.code,...(receipt.restore ? {restore:receipt.restore} : {})}])
    this.sent.delete(receipt.id);this.notify()
    return this.persist()
  }
  async dismiss(id: string) { this.pending=this.pending.filter(p=>p.command.id!==id);this.notify();await this.persist() }
  async recover(id: string, commands: Command[]) {
    if (this.blocked || !this.pending.some(item=>item.command.id===id && item.kind==="rejected")) throw new Error("invalid-recovery")
    this.pending=[...this.pending.filter(item=>item.command.id!==id),...commands.map(command=>({kind:"queued" as const,command}))]
    this.notify();await this.persist()
  }
  private notify() { this.projected=null;this.changed() }
  private persist() { return this.serial(async ()=> {
    const next=structuredClone(this.pending)
    await this.outbox.write(this.key,next)
    this.durable=new Set(next.map(item=>item.command.id))
    this.flush()
  }) }
  private serial(action: ()=>Promise<void>): Promise<void> { const result=this.work.then(action);this.work=result.catch(()=>{});return result }
  private flush() { if (this.online && !this.blocked) for (const item of this.pending) if (item.kind==="queued" && this.durable.has(item.command.id) && !this.sent.has(item.command.id)) { this.sent.add(item.command.id);this.sender?.(structuredClone(item.command)) } }
}
