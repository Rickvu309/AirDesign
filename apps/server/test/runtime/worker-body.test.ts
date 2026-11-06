import {mkdtemp,mkdir,writeFile,readdir,stat,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {OperationStore} from "../../../../packages/operations/src/index.ts"
import {workerArtifactLimit} from "../../src/worker/transport.ts"
import {request} from "node:http"
import {once} from "node:events"
import {it,expect,vi} from "vitest"
import {startServer} from "../../src/main.ts"
import {fileLimits} from "../../../../packages/files/src/index.ts"
it("accepts a worker artifact plus report while keeping public limits and authenticating first",async()=>{
 vi.stubEnv("AIRDESIGN_SECRET","test-secret")
 const server=await startServer(0,{operationsPath:":memory:",templatesPath:":memory:",historyPath:"memory://",accessPath:"memory://"})
 const base=`http://127.0.0.1:${server.port}`
 const body=JSON.stringify({kind:"complete",queue:"import",id:"00000000-0000-4000-8000-000000000000",lease:"00000000-0000-4000-8000-000000000001",report:{text:"x".repeat(7550)}})
 try{
  const unauthorized=request(base+"/internal/worker",{method:"POST",headers:{"content-length":"999999999"}})
  unauthorized.flushHeaders()
  try{const [response]=await once(unauthorized,"response",{signal:AbortSignal.timeout(5000)});expect(response.statusCode).toBe(401);response.resume()}finally{unauthorized.destroy()}
  expect((await fetch(base+"/internal/worker",{method:"POST",headers:{authorization:"Bearer test-secret"},body})).status).toBe(409)
  expect((await fetch(base+"/internal/worker",{method:"POST",body})).status).toBe(401)
  expect((await fetch(base+"/internal/worker",{method:"POST",headers:{authorization:"Bearer test-secret"},body:"x".repeat(8*1024*1024+1)})).status).toBe(413)
  expect((await fetch(base+"/api/operations",{method:"POST",body:"x".repeat(Math.ceil(fileLimits.compressed/3)*4+1001)})).status).toBe(413)
 }finally{await server.close();vi.unstubAllEnvs()}
},30000)

it("streams binary worker uploads through the HTTP server and commits their separate JSON reports",async()=>{
 const root=await mkdtemp(path.join(os.homedir(),"tmp/worker-http-")),database=path.join(root,"operations.sqlite")
 await mkdir(path.join(root,"worker-artifacts"));await writeFile(path.join(root,"worker-artifacts","abandoned.upload"),"private")
 vi.stubEnv("AIRDESIGN_SECRET","test-secret")
 const store=new OperationStore(database),owner={personId:"worker-owner"}
 const server=await startServer(0,{operationsPath:database,templatesPath:":memory:",historyPath:"memory://",accessPath:"memory://"})
 const endpoint=new URL(`http://127.0.0.1:${server.port}/internal/worker`)
 try{
  const job=store.submit(owner,"http-stream",Buffer.from("input")),lease=store.claim(job.id)
  if(!lease)throw new Error("missing-lease")
  endpoint.search=new URLSearchParams({queue:"import",id:job.id,lease:lease.lease}).toString()
  for(const authorized of [false,true]){
   const oversized=request(endpoint,{method:"PUT",headers:{"content-length":String(workerArtifactLimit+1),...authorized?{authorization:"Bearer test-secret"}:{}}})
   oversized.flushHeaders()
   try{const [response]=await once(oversized,"response",{signal:AbortSignal.timeout(5000)});expect(response.statusCode).toBe(authorized?413:401);response.resume()}finally{oversized.destroy()}
  }
  const content=Buffer.alloc(200000,42)
  let offset=0
  const body=new ReadableStream<Uint8Array>({pull(controller){if(offset===content.length){controller.close();return}const end=Math.min(offset+4096,content.length);controller.enqueue(content.subarray(offset,end));offset=end}})
  const upload={method:"PUT",headers:{authorization:"Bearer test-secret"},body,duplex:"half"}
  expect((await fetch(endpoint,upload)).status).toBe(200)
  expect(await readdir(path.join(root,"worker-artifacts"))).toEqual([lease.lease])
  expect((await stat(path.join(root,"worker-artifacts",lease.lease))).size).toBe(content.length)
  const complete=await fetch(endpoint,{method:"POST",headers:{authorization:"Bearer test-secret"},body:JSON.stringify({kind:"complete",queue:"import",id:job.id,lease:lease.lease,report:{streamed:true}})})
  expect(complete.status).toBe(200)
  expect(store.artifact(owner,job.id)).toEqual(content)
  expect(store.status(owner,job.id)).toMatchObject({kind:"ready",report:{streamed:true}})
 }finally{await server.close();store.close();await rm(root,{recursive:true,force:true});vi.unstubAllEnvs()}
},30000)
