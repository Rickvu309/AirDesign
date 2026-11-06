import {createHash,timingSafeEqual} from "node:crypto"
import {z} from "zod"
import {operationId, type OperationStore} from "../../../../packages/operations/src/index.ts"

const command = z.discriminatedUnion("kind",[
  z.object({kind:z.literal("claim"),queue:z.enum(["import","image"])}),
  z.object({kind:z.literal("active"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid()}),
  z.object({kind:z.literal("complete"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid(),result:z.string().max(700000000),report:z.record(z.string(),z.unknown())}),
  z.object({kind:z.literal("fail"),queue:z.enum(["import","image"]),id:z.string().uuid(),lease:z.string().uuid(),reason:z.string().max(200)}),
])

export function workerHandler(imports:OperationStore,images:OperationStore,secret:string,reconcile:()=>Promise<unknown>) {
  return async (request:Request):Promise<Response> => {
    const digest = (value:string) => createHash("sha256").update(value).digest()
    if (!timingSafeEqual(digest(request.headers.get("authorization") ?? ""),digest(`Bearer ${secret}`))) return Response.json({code:"unauthorized"},{status:401})
    if (request.method !== "POST") return Response.json({code:"method-not-allowed"},{status:405})
    const parsed = command.safeParse(await request.json())
    if (!parsed.success) return Response.json({code:"invalid-worker-command"},{status:400})
    const input = parsed.data, store = input.queue === "import" ? imports : images
    if (input.kind === "claim") {
      for (const expired of store.recover()) store.acknowledgeCleanup(expired.id,expired.lease)
      await reconcile()
      for (const id of store.pending()) {
        const job = store.claim(id)
        if (job) return Response.json({id,lease:job.lease,input:job.input.toString("base64")})
      }
      return Response.json(null)
    }
    const id = operationId(input.id)
    if (input.kind === "active") return Response.json({active:store.active(id,input.lease)})
    if (input.kind === "fail") store.fail(id,input.lease,input.reason)
    if (input.kind === "complete" && !store.complete(id,input.lease,Buffer.from(input.result,"base64"),input.report)) return Response.json({code:"stale-lease"},{status:409})
    store.acknowledgeCleanup(id,input.lease)
    return Response.json({ok:true})
  }
}
