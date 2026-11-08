import {expect,it} from "vitest"
import {mcpFixture} from "../../apps/server/test/mcp/fixture.ts"
import {approvalRoute} from "./approval-fixture.ts"

it("restores a consumed approval while keeping the existing signed-in session",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("ada@halden.com")
    const first=await approvalRoute(fixture.origin,fixture.apiOrigin,"Claude")
    const intent=new URL(first,fixture.origin).searchParams.get("intent")
    const cancelled=await fixture.json("/api/agents/approval",{intent,allow:false},owner.cookie)
    expect(cancelled.status).toBe(200)
    const restored=await approvalRoute(fixture.origin,fixture.apiOrigin,"Claude")
    expect(restored).not.toBe(first)
    const nextIntent=new URL(restored,fixture.origin).searchParams.get("intent")
    const context=await fixture.json(`/api/agents/approval?intent=${nextIntent}`,undefined,owner.cookie)
    expect(context.status).toBe(200)
    expect(await context.json()).toMatchObject({client:"Claude",expired:false})
    const allowed=await fixture.json("/api/agents/approval",{intent:nextIntent,allow:true},owner.cookie)
    expect(allowed.status).toBe(200)
  }finally{await fixture.close()}
})

it("keeps a seeded connection visible after its setup client closes",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("ada@halden.com")
    const {client}=await fixture.authorize(owner.cookie,"Claude")
    await client.close()
    const response=await fixture.json("/api/agents",undefined,owner.cookie)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({name:"Claude",revoked:false,expired:false})]))
  }finally{await fixture.close()}
})
