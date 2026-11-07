export const operationKinds=["queued","waiting","running","ready","failed","cancelled","expired"] as const
export type OperationKind=typeof operationKinds[number]
export type OperationTrace={id:string,kind:OperationKind,reason?:string,attempts?:number}

const operationRoute=/^\/api\/(operations\/[^/]+|catalog\/[^/]+\/exports|catalog\/export-jobs\/[^/]+\/[^/]+)$/
const operationId=/^[A-Za-z0-9_-]{1,64}$/

export function safeReason(reason:string){
  return reason
    .replace(/[\u0000-\u001f\u007f]+/g," ")
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi,"[url]")
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\b\s*[:=]\s*[^\n,]*/gi,"$1: [redacted]")
    .replace(/\bbearer\s+\S+/gi,"Bearer [redacted]")
    .replace(/\b([a-z_-]*(?:token|secret|password|passwd|session|signature|key|credential)[a-z_-]*)\b\s*[:=]\s*\S+/gi,"$1=[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi,"[redacted]")
    .replace(/(?=[A-Za-z0-9+/_=]*\d)[A-Za-z0-9+/_=]{32,}/g,"[redacted]")
    .trim()
    .slice(0,200)
}

function traceOf(value:unknown):OperationTrace|null{
  if(!value || typeof value!=="object")return null
  const {id,kind,reason,attempts}=value as Record<string,unknown>
  if(typeof id!=="string" || !operationId.test(id) || !operationKinds.includes(kind as OperationKind))return null
  return {id,kind:kind as OperationKind,...typeof reason==="string" ? {reason:safeReason(reason)} : {},...Number.isInteger(attempts) ? {attempts:attempts as number} : {}}
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
      let timer:ReturnType<typeof setTimeout>|undefined
      await Promise.race([Promise.all(reads),new Promise(resolve=>{timer=setTimeout(resolve,settleMs)})])
      clearTimeout(timer)
      return [...seen.values()]
    },
  }
}
