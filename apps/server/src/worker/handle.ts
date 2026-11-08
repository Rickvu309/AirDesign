import type {TextAdmission} from "../../../../packages/rpc/src/text/protocol.ts"
import {importSlideProgressSchema} from "../../../../packages/operations/src/import-progress.ts"
import {WorkerArtifacts} from "./artifacts.ts"
import path from "node:path"
import os from "node:os"
import {randomUUID} from "node:crypto"
import {z} from "zod"
import {workerAuthorized} from "./transport.ts"
import {operationId, type OperationStore} from "../../../../packages/operations/src/index.ts"

const command = z.discriminatedUnion("kind",[
  z.object({kind:z.literal("progress"),queue:z.literal("import"),id:z.string().uuid(),lease:z.string().uuid(),progress:importSlideProgressSchema}).strict(),
  z.object({kind:z.literal("claim"),queue:z.enum(["import","image"])}),
  z.object({kind:z.literal("cleaned"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid()}),
  z.object({kind:z.literal("active"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid()}),
  z.object({kind:z.literal("complete"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid(),report:z.record(z.string(),z.unknown())}),
  z.object({kind:z.literal("fail"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid(),reason:z.string().max(200)}),
])

export function workerHandler(imports:OperationStore,images:OperationStore,secret:string,reconcile:()=>Promise<unknown>,artifactRoot?:string,admission:()=>Promise<TextAdmission>=async()=>({kind:"ready",protocol:"legacy-text-v2"})) {
  const artifacts=new WorkerArtifacts(artifactRoot ?? (process.env.AIRDESIGN_OPERATIONS_PATH ? path.join(path.dirname(process.env.AIRDESIGN_OPERATIONS_PATH),"worker-artifacts") : path.join(os.homedir(),"tmp",`worker-artifacts-${randomUUID()}`)))
  return async (request:Request):Promise<Response> => {
    if (!workerAuthorized(request.headers.get("authorization"),secret)) return Response.json({code:"unauthorized"},{status:401})
    if(request.method==="PUT"){
      const input=z.object({queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid()}).safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if(!input.success)return Response.json({code:"invalid-worker-upload"},{status:400})
      const {queue,id,lease}=input.data,store=queue==="import"?imports:images
      if(!store.active(operationId(id),lease))return Response.json({code:"stale-lease"},{status:409})
      return artifacts.upload(request,lease)
    }
    if (request.method !== "POST") return Response.json({code:"method-not-allowed"},{status:405})
    const parsed = command.safeParse(await request.json())
    if (!parsed.success) return Response.json({code:"invalid-worker-command"},{status:400})
    const input = parsed.data, store = input.queue === "import" ? imports : images
    if (input.kind === "claim") {
      const state=await admission()
      if(state.kind==="paused")return Response.json({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"},{status:409})
      if(state.protocol==="paragraph-body-v3" && request.headers.get("x-worker-text-protocols")!=="legacy-text-v2,paragraph-body-v3")return Response.json({kind:"refused",code:"editing-protocol-mismatch",retryable:false,next:"retain-and-reconcile"},{status:409})
      const cleanup=store.recover().map(({id,lease})=>({id,lease}))
      if(cleanup.length)return Response.json({cleanup})
      await reconcile()
      for (const id of store.pending()) {
        const job = store.claim(id)
        if (job) return Response.json({id,lease:job.lease,input:job.input.toString("base64"),textProtocol:state.protocol})
      }
      return Response.json(null)
    }
    const id = operationId(input.id)
    if(input.kind === "progress")return store.recordProgress(id,input.lease,input.progress) ? Response.json({ok:true}) : Response.json({code:"stale-or-invalid-progress"},{status:409})
    if(input.kind === "cleaned"){store.recover();store.acknowledgeCleanup(id,input.lease);await reconcile();return Response.json({ok:true})}
    if (input.kind === "active") return Response.json({active:store.active(id,input.lease)})
    if (input.kind === "fail") {store.fail(id,input.lease,input.reason);await artifacts.erase(input.lease)}
    if(input.kind==="complete"){
      if(!store.active(id,input.lease)){await artifacts.erase(input.lease);return Response.json({code:"stale-lease"},{status:409})}
      const result=await artifacts.take(input.lease)
      if(!result)return Response.json({code:"artifact-required"},{status:400})
      if(!store.complete(id,input.lease,result,input.report))return Response.json({code:"stale-lease"},{status:409})
    }
    return Response.json({ok:true})
  }
}
