import {within} from "./bounded.ts"

export const operationKinds=["queued","waiting","running","ready","failed","cancelled","expired"] as const
export type OperationKind=typeof operationKinds[number]
export type OperationTrace={id:string,kind:Exclude<OperationKind,"failed">,attempts?:number}|{id:string,kind:"failed",reason:string,attempts?:number}

const operationRoute=/^\/api\/(operations\/[^/]+|catalog\/[^/]+\/exports|catalog\/export-jobs\/[^/]+\/[^/]+)$/
const operationId=/^[A-Za-z0-9_-]{1,64}$/

const reasonCode=/^([a-z]+(?:-[a-z]+)+)(?=$|:|\s)(?::(-?\d{1,5}|null)(?=:|$))?/

export function safeReason(reason:string){
  const match=reasonCode.exec(reason)
  if(!match)return "unclassified (details omitted)"
  const code=match[2]===undefined ? match[1]! : `${match[1]}:${match[2]}`
  return reason.slice(match[0].length).replace(/^:/,"").trim() ? `${code} (details omitted)` : code
}

function traceOf(value:unknown):OperationTrace|null{
  if(!value || typeof value!=="object")return null
  const {id,kind,reason,attempts}=value as Record<string,unknown>
  if(typeof id!=="string" || !operationId.test(id) || !operationKinds.includes(kind as OperationKind))return null
  const counted=Number.isInteger(attempts) ? {attempts:attempts as number} : {}
  if(kind==="failed")return {id,kind,reason:typeof reason==="string" ? safeReason(reason) : "unclassified (details omitted)",...counted}
  return {id,kind:kind as Exclude<OperationKind,"failed">,...counted}
}

export function operationTracker(settleMs:number){
  let traces=new Map<string,OperationTrace>(),pending=new Set<Promise<void>>()
  return {
    begin(){traces=new Map();pending=new Set()},
    observe(method:string,pathname:string,contentType:string|undefined,body:()=>Promise<unknown>){
      if(method!=="GET" || !contentType?.includes("application/json") || !operationRoute.test(pathname))return
      const seen=traces,reads=pending,read=body().then(value=>{
        for(const item of Array.isArray(value) ? value : [value]){const trace=traceOf(item);if(trace){seen.delete(trace.id);seen.set(trace.id,trace)}}
      },()=>undefined)
      reads.add(read);void read.finally(()=>reads.delete(read))
    },
    async settled():Promise<OperationTrace[]>{
      const seen=traces,reads=[...pending]
      await within(Promise.all(reads).then(()=>undefined),settleMs,undefined)
      return [...seen.values()]
    },
  }
}
