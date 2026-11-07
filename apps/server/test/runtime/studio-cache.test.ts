import {createServer} from "node:http"
import {once} from "node:events"
import {afterAll,beforeAll,expect,it,vi} from "vitest"
import {serveStudio} from "../../src/runtime/studio.ts"

vi.mock("node:fs/promises",()=>({readFile:vi.fn(async()=>Buffer.from("asset"))}))
const server=createServer((request,response)=>{void serveStudio(request,response)})
let origin:string
beforeAll(async()=>{vi.stubEnv("NODE_ENV","production");server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();if(!address || typeof address==="string")throw new Error("missing-test-origin");origin=`http://127.0.0.1:${address.port}`})
afterAll(async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error ? reject(error) : resolve()));vi.unstubAllEnvs()})
it("caches content-hashed scripts, styles and fonts immutably",async()=>{
  for(const file of ["index-Ab123456.js","index-Ab123456.css","font-Ab123456.woff2"]){
    const response=await fetch(origin+"/assets/"+file)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
  }
})
it("does not cache mutable assets or Studio HTML",async()=>{
  for(const route of ["/assets/index.js","/studio","/deck/example"]){
    const response=await fetch(origin+route)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
})
