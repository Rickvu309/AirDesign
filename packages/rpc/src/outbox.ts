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
  write(key: string, items: Pending[], removed?: string[]): Promise<void>
}
export function outboxKey(person: string, deck: string): string { return JSON.stringify([person,deck]) }
export function indexedOutbox(): Outbox {
  const opened = new Promise<IDBDatabase>((resolve,reject)=> {
    const request = indexedDB.open("airdesign-outbox",2)
    request.onupgradeneeded = ()=>{
      const db=request.result
      db.createObjectStore("commands")
      if(db.objectStoreNames.contains("queues")) {
        const cursor=request.transaction?.objectStore("queues").openCursor()
        if(cursor)cursor.onsuccess=()=>{
          const row=cursor.result
          if(!row)return
          for(const [index,item] of parsePending(row.value).entries())request.transaction?.objectStore("commands").put({pending:item,queuedAt:Date.now()+index},[String(row.key),item.command.id])
          row.continue()
        }
      }
    }
    request.onsuccess = ()=>resolve(request.result)
    request.onerror = ()=>reject(request.error)
  })
  return {
    async read(key) {
      const db = await opened
      return new Promise((resolve,reject)=> {
        const tx = db.transaction("commands","readonly")
        const request = tx.objectStore("commands").getAll(IDBKeyRange.bound([key],[key,[]]))
        request.onsuccess = ()=>{try {resolve(parsePending(request.result.sort((a:{queuedAt:number},b:{queuedAt:number})=>a.queuedAt-b.queuedAt).map((row:{pending:unknown})=>row.pending)))} catch(error) {reject(error)}}
        request.onerror = ()=>reject(request.error)
      })
    },
    async write(key,items,removed=[]) {
      const db = await opened
      return new Promise((resolve,reject)=> {
        const tx = db.transaction("commands","readwrite")
        const store=tx.objectStore("commands")
        for(const id of removed)store.delete([key,id])
        for(const item of items) {
          const previous=store.get([key,item.command.id])
          const queuedAt=performance.timeOrigin+performance.now()
          previous.onsuccess=()=>store.put({pending:structuredClone(item),queuedAt:previous.result?.queuedAt ?? queuedAt},[key,item.command.id])
        }
        tx.oncomplete = ()=>resolve()
        tx.onerror = ()=>reject(tx.error)
        tx.onabort = ()=>reject(tx.error ?? new Error("outbox-aborted"))
      })
    },
  }
}
