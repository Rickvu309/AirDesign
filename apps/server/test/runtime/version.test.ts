import {expect,it} from "vitest"
import {mcpFixture} from "../mcp/fixture.ts"
import {readBuildIdentity} from "../../../../scripts/live/build-identity.ts"

it("serves the baked build identity without caching and applies secure-origin headers",async()=>{
  const fixture=await mcpFixture({publicOrigin:"https://studio.example.invalid",exposeInbox:false})
  try{
    const response=await fetch(fixture.apiOrigin+"/version")
    expect(response.status).toBe(200)
    const identity=await response.json()
    expect(identity).toMatchObject({sha:(await readBuildIdentity()).sha,builtAt:expect.any(String)})
    expect(Number.isFinite(Date.parse(identity.builtAt))).toBe(true)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect((await fetch(fixture.apiOrigin+"/api/dev/inbox")).status).toBe(404)
  }finally{await fixture.close()}
})
