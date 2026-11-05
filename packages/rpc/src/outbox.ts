import { commandId, type Command, type CommandId } from "../../change-log/src/index.ts"
import { parseCommand } from "./parse-command.ts"
export type Pending = { command: Command; kind: "queued" } | { command: Command; kind: "rejected"; code: string; restore?: CommandId }
function parsePending(value:unknown):Pending[] {
  if (!Array.isArray(value)) throw new Error("invalid-outbox")
  return value.map((item:unknown)=> {
    if (!item || typeof item!=="object" || !("command" in item) || !("kind" in item)) throw new Error("invalid-outbox")
    const command=parseCommand(item.command)
    if (item.kind==="queued") return {kind:"queued",command}
    if (item.kind==="rejected" && "code" in item && typeof item.code==="string") return {kind:"rejected",command,code:item.code,...("restore" in item && typeof item.restore==="string" ? {restore:commandId(item.restore)} : {})}
    throw new Error("invalid-outbox")
  })
}
export interface Outbox {
  read(key: string): Promise<Pending[]>
  write(key: string, items: Pending[]): Promise<void>
}
export function outboxKey(person: string, deck: string): string { return JSON.stringify([person,deck]) }
export function indexedOutbox(): Outbox {
  const opened = new Promise<IDBDatabase>((resolve,reject)=> {
    const request = indexedDB.open("airdesign-outbox",1)
    request.onupgradeneeded = ()=>request.result.createObjectStore("queues")
    request.onsuccess = ()=>resolve(request.result)
    request.onerror = ()=>reject(request.error)
  })
  return {
    async read(key) {
      const db = await opened
      return new Promise((resolve,reject)=> {
        const tx = db.transaction("queues","readonly")
        const request = tx.objectStore("queues").get(key)
        request.onsuccess = ()=>{try {resolve(parsePending(request.result ?? []))} catch(error) {reject(error)}}
        request.onerror = ()=>reject(request.error)
      })
    },
    async write(key,items) {
      const db = await opened
      return new Promise((resolve,reject)=> {
        const tx = db.transaction("queues","readwrite")
        tx.objectStore("queues").put(structuredClone(items),key)
        tx.oncomplete = ()=>resolve()
        tx.onerror = ()=>reject(tx.error)
        tx.onabort = ()=>reject(tx.error ?? new Error("outbox-aborted"))
      })
    },
  }
}
