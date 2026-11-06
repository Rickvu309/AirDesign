import {it,expect,vi} from "vitest"
import {OperationStore} from "../../../../packages/operations/src/index.ts"
import {workerHandler} from "../../src/worker/handle.ts"

it("moves work between services and fences cancellation and obsolete leases",async()=>{
  const imports=new OperationStore(":memory:"),images=new OperationStore(":memory:")
  const reconcile=vi.fn(async()=>[])
  const owner={personId:"owner"},handler=workerHandler(imports,images,"test-secret",reconcile)
  const request=(body:unknown,authorization="Bearer test-secret")=>handler(new Request("https://studio.example.invalid/internal/worker",{method:"POST",headers:{authorization,"content-type":"application/json"},body:JSON.stringify(body)}))
  try {
    const job=imports.submit(owner,"request",Buffer.from("fixture"))
    expect((await request({kind:"claim",queue:"import"},"Bearer wrong")).status).toBe(401)
    expect(reconcile).not.toHaveBeenCalled()
    const claim=await (await request({kind:"claim",queue:"import"})).json()
    expect(reconcile).toHaveBeenCalledOnce()
    expect(claim.id).toBe(job.id)
    expect(Buffer.from(claim.input,"base64").toString()).toBe("fixture")
    expect(await (await request({kind:"active",queue:"import",id:job.id,lease:claim.lease})).json()).toEqual({active:true})
    imports.cancel(owner,job.id)
    expect((await request({kind:"complete",queue:"import",id:job.id,lease:claim.lease,report:{}})).status).toBe(409)
    expect(imports.status(owner,job.id).kind).toBe("cancelled")
    const image=images.submit(owner,"image",Buffer.from("image"))
    const imageClaim=await (await request({kind:"claim",queue:"image"})).json()
    const upload=new URL("https://studio.example.invalid/internal/worker")
    upload.search=new URLSearchParams({queue:"image",id:image.id,lease:imageClaim.lease}).toString()
    expect((await handler(new Request(upload,{method:"PUT",headers:{authorization:"Bearer test-secret"},body:"image"}))).status).toBe(200)
    expect((await request({kind:"complete",queue:"image",id:image.id,lease:imageClaim.lease,report:{validated:true}})).status).toBe(200)
    expect(images.artifact(owner,image.id).toString()).toBe("image")
  } finally { imports.close(); images.close() }
})

it("retains expired remote leases until the worker confirms scratch cleanup",async()=>{
 let now=0
 const imports=new OperationStore(":memory:",()=>now),images=new OperationStore(":memory:")
 const handler=workerHandler(imports,images,"test-secret",async()=>[]),owner={personId:"owner"}
 const request=(body:unknown)=>handler(new Request("https://studio.invalid/internal/worker",{method:"POST",headers:{authorization:"Bearer test-secret"},body:JSON.stringify(body)}))
 try{
  const job=imports.submit(owner,"crash",Buffer.from("upload")),lease=imports.claim(job.id)
  now=40000
  const response=await (await request({kind:"claim",queue:"import"})).json()
  expect(response).toEqual({cleanup:[{id:job.id,lease:lease?.lease}]})
  expect(imports.claim(job.id)).toBeNull()
 }finally{imports.close();images.close()}
})
