import {RemoteJournal} from "./remote-journal.ts"
import {isolationMode} from "./container-process.ts"
import {z} from "zod"
import path from "node:path"
import {OperationStore} from "../../../packages/operations/src/index.ts"
import {deliver} from "./isolation.ts"

const cleanup=z.object({cleanup:z.array(z.object({id:z.string().uuid(),lease:z.string().uuid()}))})
const claim = z.object({id:z.string().uuid(),lease:z.string().uuid(),input:z.string()}).nullable()
const active = z.object({active:z.boolean()})

export async function drainRemoteQueue(origin:string,secret:string,root:string,signal?:AbortSignal):Promise<void> {
  async function request(body:unknown) {
    signal?.throwIfAborted()
    const response = await fetch(new URL("/internal/worker",origin),{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.any([...(signal ? [signal] : []),AbortSignal.timeout(15000)]),redirect:"error"})
    if (!response.ok) throw new Error(`worker-api-failed:${response.status}`)
    return response.json()
  }
  const journal=new RemoteJournal(root)
  try{
  for(const entry of journal.entries().filter(entry=>entry.queue!=="export")){
    signal?.throwIfAborted()
    await journal.clean(entry)
    await request({kind:"fail",queue:entry.queue,id:entry.id,lease:entry.lease,reason:"worker-restarted"})
    await request({kind:"cleaned",queue:entry.queue,id:entry.id,lease:entry.lease})
    journal.forget(entry.lease)
  }
  for (const queue of ["image","import"] as const) for (;!signal?.aborted;) {
    const response=await request({kind:"claim",queue})
    if(cleanup.safeParse(response).success)throw new Error("remote-cleanup-required-on-original-worker-volume")
    const job = claim.parse(response)
    if (!job) break
    signal?.throwIfAborted()
    const database=path.join(root,`remote-${job.lease}.sqlite`)
    journal.save({...job,queue,database,directory:null,unit:null,pid:null,identity:null,mode:isolationMode()})
    const store = new OperationStore(database),principal = {personId:job.id}
    const local = store.submit(principal,job.id,Buffer.from(job.input,"base64"))
    let pending: Promise<void> = Promise.resolve()
    let checking = false
    const cancellation = setInterval(() => {
      if (checking) return
      checking = true
      pending = request({kind:"active",queue,id:job.id,lease:job.lease}).then(value => { if (!active.parse(value).active) store.cancel(principal,local.id) }).catch(() => { store.cancel(principal,local.id) }).finally(() => { checking = false })
    },100)
    try {
      await deliver(store,local.id,root,path.join(import.meta.dirname,queue === "import" ? "import.ts" : "validate-image.ts"),process=>journal.started(job.lease,process),signal)
      clearInterval(cancellation)
      const status = store.status(principal,local.id)
      if (status.kind === "ready") {
        const url=new URL("/internal/worker",origin)
        url.search=new URLSearchParams({queue,id:job.id,lease:job.lease}).toString()
        const artifact=store.artifact(principal,local.id)
        let offset=0
        const body=new ReadableStream<Uint8Array>({pull(controller){if(offset===artifact.length){controller.close();return}const end=Math.min(offset+65536,artifact.length);controller.enqueue(artifact.subarray(offset,end));offset=end}})
        const upload={method:"PUT",headers:{authorization:`Bearer ${secret}`,"content-type":"application/octet-stream"},body,duplex:"half",signal:AbortSignal.any([...(signal ? [signal] : []),AbortSignal.timeout(120000)]),redirect:"error"} satisfies RequestInit & {duplex:"half"}
        const response=await fetch(url,upload)
        if(!response.ok)throw new Error(`worker-artifact-failed:${response.status}`)
        await request({kind:"complete",queue,id:job.id,lease:job.lease,report:status.report})
      }
      else await request({kind:"fail",queue,id:job.id,lease:job.lease,reason:status.kind === "failed" ? status.reason : "worker-cancelled"})
    } finally { clearInterval(cancellation); await pending; store.close() }
    const entry=journal.entries().find(entry=>entry.lease===job.lease)
    if(!entry)throw new Error("missing-remote-journal")
    await journal.clean(entry)
    await request({kind:"cleaned",queue,id:job.id,lease:job.lease})
    journal.forget(job.lease)
  }
  }finally{journal.close()}
}
