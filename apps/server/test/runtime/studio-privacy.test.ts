import {createServer} from "node:http"
import {afterEach,expect,it,vi} from "vitest"
import {serveStudio} from "../../src/runtime/studio.ts"
import {mcpFixture} from "../mcp/fixture.ts"

afterEach(()=>vi.unstubAllEnvs())

it("never stores Studio HTML, including the explicit index document",async()=>{
  vi.stubEnv("NODE_ENV","production")
  const server=createServer((request,response)=>{void serveStudio(request,response)})
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve))
  const address=server.address()
  if(!address||typeof address==="string")throw new Error("port-missing")
  try{
    for(const pathname of ["/","/settings/usage","/settings/account","/index.html"]){
      for(const method of ["GET","HEAD"]){
        const response=await fetch(`http://127.0.0.1:${address.port}${pathname}`,{method})
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toContain("text/html")
        expect(response.headers.get("cache-control")).toBe("no-store")
        await response.arrayBuffer()
      }
    }
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error ? reject(error) : resolve()))}
})

it("never stores account API responses before or after revocation",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("privacy@example.com")
    for(const pathname of ["/api/session","/api/account","/api/usage","/api/catalog","/api/agents"]){
      const response=await fixture.json(pathname,undefined,owner.cookie)
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      await response.arrayBuffer()
    }
    await fixture.json("/api/session/revoke",{},owner.cookie)
    const response=await fixture.json("/api/session",undefined,owner.cookie)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({status:"signed-out"})
  }finally{await fixture.close()}
},60000)
