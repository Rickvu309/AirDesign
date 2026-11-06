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
    expect((await request({kind:"complete",queue:"import",id:job.id,lease:claim.lease,result:"Zml4dHVyZQ==",report:{}})).status).toBe(409)
    expect(imports.status(owner,job.id).kind).toBe("cancelled")
    const image=images.submit(owner,"image",Buffer.from("image"))
    const imageClaim=await (await request({kind:"claim",queue:"image"})).json()
    expect((await request({kind:"complete",queue:"image",id:image.id,lease:imageClaim.lease,result:"aW1hZ2U=",report:{validated:true}})).status).toBe(200)
    expect(images.artifact(owner,image.id).toString()).toBe("image")
  } finally { imports.close(); images.close() }
})
