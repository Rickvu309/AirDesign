import {afterAll,beforeAll,expect,it,vi} from "vitest"
import {PGlite} from "@electric-sql/pglite"
import {createOperatorSmoke} from "../src/operator-smoke.ts"
import {createAccess,createMemoryInbox} from "../src/index.ts"
let access:Awaited<ReturnType<typeof createAccess>>,operator:Awaited<ReturnType<typeof createOperatorSmoke>>,client:PGlite,now=Date.now()
const origin="http://127.0.0.1:41732",email="smoke@example.com"
beforeAll(async()=>{
  vi.stubEnv("AIRDESIGN_SMOKE_EMAILS",email)
  client=await PGlite.create()
  const driver={kind:"pglite",dataDir:"memory://",client} as const
  const secret="smoke-test-secret-at-least-32-characters"
  access=await createAccess({driver,secret,publicOrigin:origin,mail:createMemoryInbox(),clock:()=>now,guard:{allow:()=>true},exposeInbox:false})
  operator=await createOperatorSmoke({driver,secret,publicOrigin:origin,clock:()=>now})
})
afterAll(async()=>{await operator.close();await access.close();await client.close();vi.unstubAllEnvs()})
async function consume(link:string){return access.handle(new Request(origin+"/api/access/consume-link",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({token:new URL(link).searchParams.get("token")})}))}
it("refuses absent allowlists and non-smoke addresses",async()=>{
  vi.stubEnv("AIRDESIGN_SMOKE_EMAILS","")
  await expect(createOperatorSmoke({driver:{kind:"pglite"},secret:"unused",publicOrigin:origin,clock:()=>now})).rejects.toThrow("smoke-email-not-allowlisted")
  await expect(operator.mintSmokeLink("person@example.com")).rejects.toThrow("smoke-email-not-allowlisted")
})
it("uses normal session cookies and atomically rejects concurrent reuse",async()=>{
  const link=await operator.mintSmokeLink(email),responses=await Promise.all([consume(link),consume(link)])
  expect(responses.map(value=>value.status).sort()).toEqual([200,400])
  const signed=responses.find(value=>value.status===200)
  expect(signed?.headers.get("set-cookie")).toContain("session")
  expect((await consume(link)).status).toBe(400)
})
it("rejects links at the two-minute expiry",async()=>{
  const link=await operator.mintSmokeLink(email);now+=120_000
  const response=await consume(link)
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({status:"link-expired"})
})
it("has no HTTP mint route and exposes no inbox",async()=>{
  expect((await access.handle(new Request(origin+"/api/access/smoke"))).status).toBe(404)
  expect((await access.handle(new Request(origin+"/api/dev/inbox"))).status).toBe(404)
})

it("cannot mint an ordinary session from request-handler access with an empty environment allowlist",async()=>{
  const previous=process.env.AIRDESIGN_SMOKE_EMAILS
  process.env.AIRDESIGN_SMOKE_EMAILS=""
  try {
    if("mintSmokeLink" in access && typeof access.mintSmokeLink==="function") {
      const link=await access.mintSmokeLink("ordinary@example.com",["ordinary@example.com"])
      expect((await consume(link)).status).not.toBe(200)
    }
    expect("mintSmokeLink" in access).toBe(false)
  } finally {if(previous===undefined)delete process.env.AIRDESIGN_SMOKE_EMAILS;else process.env.AIRDESIGN_SMOKE_EMAILS=previous}
})

it("binds the operator allowlist once instead of trusting later callers or environment changes",async()=>{
  vi.stubEnv("AIRDESIGN_SMOKE_EMAILS","ordinary@example.com")
  await expect(operator.mintSmokeLink("ordinary@example.com")).rejects.toThrow("smoke-email-not-allowlisted")
  expect((await consume(await operator.mintSmokeLink(email))).status).toBe(200)
})
