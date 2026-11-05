import { commandId, type Command, type Receipt } from "../../change-log/src/index.ts"
import { parseCommand } from "./parse-command.ts"
import { parseSnapshot, type Snapshot } from "./client.ts"
export type Message = ({kind:"snapshot"} & Snapshot) | ({kind:"receipt";receipt:Receipt} & Snapshot) | {kind:"replay";head:number;events:{seq:number;command:Command}[]} | {kind:"signed-out"} | {kind:"error";code:string}
export function parseMessage(value: unknown): Message {
  if (!value || typeof value !== "object" || !("kind" in value)) throw new Error("invalid-message")
  if (value.kind === "signed-out") return {kind:"signed-out"}
  if (value.kind === "error" && "code" in value && typeof value.code === "string") return {kind:"error",code:value.code}
  if (value.kind === "snapshot") return {kind:"snapshot",...parseSnapshot(value)}
  if (value.kind === "replay" && "head" in value && typeof value.head === "number" && Number.isSafeInteger(value.head) && value.head>=0 && "events" in value && Array.isArray(value.events)) {
    const head=value.head
    const events=value.events.map((event:unknown)=> {
      if (!event || typeof event!=="object" || !("seq" in event) || typeof event.seq!=="number" || !Number.isSafeInteger(event.seq) || event.seq<1 || !("command" in event)) throw new Error("invalid-replay")
      return {seq:event.seq,command:parseCommand(event.command)}
    })
    if (events.length>100 || events.some((event,index)=>event.seq>head || (index>0 && event.seq!==(events[index-1]?.seq ?? 0)+1))) throw new Error("invalid-replay-order")
    return {kind:"replay",head,events}
  }
  if (value.kind === "receipt" && "receipt" in value && value.receipt && typeof value.receipt === "object") {
    const r = value.receipt
    if (!("id" in r) || typeof r.id !== "string" || !("seq" in r) || typeof r.seq !== "number" || !Number.isSafeInteger(r.seq) || r.seq < 0 || !("kind" in r)) throw new Error("invalid-receipt")
    const id=commandId(r.id)
    if (r.kind === "applied") return {kind:"receipt",receipt:{kind:"applied",id,seq:r.seq},...parseSnapshot(value)}
    if (r.kind === "refused" && "code" in r && typeof r.code === "string" && "command" in r) return {kind:"receipt",receipt:{kind:"refused",id,seq:r.seq,code:r.code,command:parseCommand(r.command),...("restore" in r && typeof r.restore==="string" ? {restore:commandId(r.restore)} : {})},...parseSnapshot(value)}
  }
  throw new Error("invalid-message")
}
