import {it,expect} from "vitest"
import {mkdtemp,stat,rm,readdir} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {WorkerArtifacts} from "../../src/worker/artifacts.ts"
import {workerArtifactLimit} from "../../src/worker/transport.ts"

it("streams an exact-limit binary artifact with bounded memory and rejects one extra byte without buffering it",async()=>{
  const root=await mkdtemp(path.join(os.homedir(),"tmp/worker-stream-")),artifacts=new WorkerArtifacts(root)
  const chunk=new Uint8Array(65536).fill(37)
  let produced=0,cancelled=false,peak=0
  const baseline=process.memoryUsage().arrayBuffers
  function body(total:number,close=true){return new ReadableStream<Uint8Array>({pull(controller){
    peak=Math.max(peak,process.memoryUsage().arrayBuffers-baseline)
    if(produced>=total){if(close)controller.close();return}
    const bytes=Math.min(chunk.length,total-produced)
    produced+=bytes;controller.enqueue(chunk.subarray(0,bytes))
  },cancel(){cancelled=true}})}
  function upload(body:ReadableStream<Uint8Array>,headers?:HeadersInit){const options={method:"PUT",body,headers,duplex:"half"};return new Request("https://worker.test/internal/worker",options)}
  try{
    const exact=upload(body(workerArtifactLimit))
    expect((await artifacts.upload(exact,"exact")).status).toBe(200)
    expect((await stat(path.join(root,"exact"))).size).toBe(workerArtifactLimit)
    expect(peak).toBeLessThan(64*1024*1024)
    await artifacts.erase("exact")
    produced=0
    const over=upload(body(workerArtifactLimit+1,false))
    expect((await artifacts.upload(over,"over")).status).toBe(413)
    expect(cancelled).toBe(true)
    expect(produced).toBe(workerArtifactLimit+1)
    expect(await readdir(root).catch(()=>[])).toEqual([])
    let read=false
    const advertised=upload(new ReadableStream({pull(){read=true}},{highWaterMark:0}),{"content-length":String(workerArtifactLimit+1)})
    expect((await artifacts.upload(advertised,"advertised")).status).toBe(413)
    expect(read).toBe(false)
  }finally{await rm(root,{recursive:true,force:true})}
},120000)
