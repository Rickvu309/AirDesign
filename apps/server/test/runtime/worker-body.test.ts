import {request} from "node:http"
import {once} from "node:events"
import {it,expect,vi} from "vitest"
import {startServer} from "../../src/main.ts"
import {fileLimits} from "../../../../packages/files/src/index.ts"
it("accepts a worker artifact plus report while keeping public limits and authenticating first",async()=>{
 vi.stubEnv("AIRDESIGN_SECRET","test-secret")
 const server=await startServer(0,{operationsPath:":memory:",templatesPath:":memory:",historyPath:"memory://",accessPath:"memory://"})
 const base=`http://127.0.0.1:${server.port}`
 const body=JSON.stringify({kind:"complete",queue:"import",id:"00000000-0000-4000-8000-000000000000",lease:"00000000-0000-4000-8000-000000000001",result:Buffer.alloc(fileLimits.compressed).toString("base64"),report:{text:"x".repeat(7550)}})
 try{
  const unauthorized=request(base+"/internal/worker",{method:"POST",headers:{"content-length":"999999999"}})
  unauthorized.flushHeaders()
  try{const [response]=await once(unauthorized,"response",{signal:AbortSignal.timeout(5000)});expect(response.statusCode).toBe(401);response.resume()}finally{unauthorized.destroy()}
  expect((await fetch(base+"/internal/worker",{method:"POST",headers:{authorization:"Bearer test-secret"},body})).status).toBe(409)
  expect((await fetch(base+"/internal/worker",{method:"POST",body})).status).toBe(401)
  expect((await fetch(base+"/api/operations",{method:"POST",body})).status).toBe(413)
 }finally{await server.close();vi.unstubAllEnvs()}
},30000)
