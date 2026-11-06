import {z} from "zod"
import path from "node:path"
import {OperationStore} from "../../../packages/operations/src/index.ts"
import {deliver} from "./isolation.ts"

const claim = z.object({id:z.string().uuid(),lease:z.string().uuid(),input:z.string()}).nullable()
const active = z.object({active:z.boolean()})

export async function drainRemoteQueue(origin:string,secret:string,root:string):Promise<void> {
  async function request(body:unknown) {
    const response = await fetch(new URL("/internal/worker",origin),{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:"error"})
    if (!response.ok) throw new Error(`worker-api-failed:${response.status}`)
    return response.json()
  }
  for (const queue of ["image","import"] as const) for (;;) {
    const job = claim.parse(await request({kind:"claim",queue}))
    if (!job) break
    const store = new OperationStore(":memory:"),principal = {personId:job.id}
    const local = store.submit(principal,job.id,Buffer.from(job.input,"base64"))
    let pending: Promise<void> = Promise.resolve()
    let checking = false
    const cancellation = setInterval(() => {
      if (checking) return
      checking = true
      pending = request({kind:"active",queue,id:job.id,lease:job.lease}).then(value => { if (!active.parse(value).active) store.cancel(principal,local.id) }).catch(() => { store.cancel(principal,local.id) }).finally(() => { checking = false })
    },100)
    try {
      await deliver(store,local.id,root,path.join(import.meta.dirname,queue === "import" ? "import.ts" : "validate-image.ts"))
      clearInterval(cancellation)
      const status = store.status(principal,local.id)
      if (status.kind === "ready") await request({kind:"complete",queue,id:job.id,lease:job.lease,result:store.artifact(principal,local.id).toString("base64"),report:status.report})
      else await request({kind:"fail",queue,id:job.id,lease:job.lease,reason:status.kind === "failed" ? status.reason : "worker-cancelled"})
    } finally { clearInterval(cancellation); await pending; store.close() }
  }
}
