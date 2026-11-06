import {afterAll,beforeAll,expect,it} from "vitest"
import {createAccess,createMemoryInbox} from "../src/index.ts"
let access:Awaited<ReturnType<typeof createAccess>>,now=Date.now()
const origin="http://127.0.0.1:41732",email="smoke@example.com"
beforeAll(async()=>{access=await createAccess({driver:{kind:"pglite"},secret:"smoke-test-secret-at-least-32-characters",publicOrigin:origin,mail:createMemoryInbox(),clock:()=>now,guard:{allow:()=>true},exposeInbox:false})})
afterAll(async()=>{await access.close()})
async function consume(link:string){return access.handle(new Request(origin+"/api/access/consume-link",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({token:new URL(link).searchParams.get("token")})}))}
it("refuses absent allowlists and non-smoke addresses",async()=>{
  await expect(access.mintSmokeLink(email,[])).rejects.toThrow("smoke-email-not-allowlisted")
  await expect(access.mintSmokeLink("person@example.com",[email])).rejects.toThrow("smoke-email-not-allowlisted")
})
it("uses normal session cookies and atomically rejects concurrent reuse",async()=>{
  const link=await access.mintSmokeLink(email,[email]),responses=await Promise.all([consume(link),consume(link)])
  expect(responses.map(value=>value.status).sort()).toEqual([200,400])
  const signed=responses.find(value=>value.status===200)
  expect(signed?.headers.get("set-cookie")).toContain("session")
  expect((await consume(link)).status).toBe(400)
})
it("rejects links at the two-minute expiry",async()=>{
  const link=await access.mintSmokeLink(email,[email]);now+=120_000
  const response=await consume(link)
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({status:"link-expired"})
})
it("has no HTTP mint route and exposes no inbox",async()=>{
  expect((await access.handle(new Request(origin+"/api/access/smoke"))).status).toBe(404)
  expect((await access.handle(new Request(origin+"/api/dev/inbox"))).status).toBe(404)
})
