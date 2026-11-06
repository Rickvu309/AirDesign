import {expect,it} from "vitest"
import {mcpFixture} from "./fixture.ts"
it("enforces public OAuth boundaries, preserves expired consent and immediately revokes refresh families",async()=>{
  const fixture=await mcpFixture()
  try{
    const owner=await fixture.signIn("oauth-owner@example.com"),authorized=await fixture.authorize(owner.cookie)
    const metadata=await (await fixture.json("/.well-known/oauth-authorization-server")).json()
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"])
    expect((await (await fixture.json("/.well-known/oauth-protected-resource/mcp")).json()).resource).toBe(fixture.origin+"/mcp")
    expect((await fixture.json("/oauth/register",{client_name:"Bad client",redirect_uris:["http://example.com/callback"]})).status).toBe(400)
    async function begin(overrides:Record<string,string>={}){
      const params=new URLSearchParams(authorized.params)
      for(const [key,value] of Object.entries(overrides))params.set(key,value)
      return fetch(fixture.origin+"/oauth/authorize?"+params,{redirect:"manual"})
    }
    const invalidRequests:Record<string,string>[]=[{redirect_uri:"http://127.0.0.1:49199/other"},{resource:fixture.origin+"/different"},{code_challenge_method:"plain"}]
    for(const overrides of invalidRequests)expect((await begin(overrides)).status).toBe(400)
    const approval=await begin(),intent=new URL(approval.headers.get("location")!).searchParams.get("intent")!
    const denied=await (await fixture.json("/api/agents/approval",{intent,allow:false},owner.cookie)).json()
    const deniedRedirect=new URL(denied.redirect)
    expect(deniedRedirect.origin+deniedRedirect.pathname).toBe(authorized.registered.redirect_uris[0])
    expect(deniedRedirect.searchParams.get("error")).toBe("access_denied")
    const pending=await begin(),pendingIntent=new URL(pending.headers.get("location")!).searchParams.get("intent")!
    const allowed=await (await fixture.json("/api/agents/approval",{intent:pendingIntent,allow:true},owner.cookie)).json()
    const code=new URL(allowed.redirect).searchParams.get("code")!
    async function token(form:Record<string,string>){return fetch(fixture.origin+"/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(form)})}
    for(const code_verifier of ["","x".repeat(64)])expect((await token({...authorized.form,code,code_verifier})).status).toBe(400)
    expect((await token({...authorized.form,code,resource:fixture.origin+"/wrong"})).status).toBe(400)
    const issued=await (await token({...authorized.form,code})).json()
    expect(issued.access_token).toBeTruthy()
    const refresh={grant_type:"refresh_token",refresh_token:issued.refresh_token,client_id:authorized.registered.client_id,resource:fixture.origin+"/mcp"}
    const parallel=await Promise.all([token(refresh),token(refresh)])
    expect(parallel.map(value=>value.status).sort()).toEqual([200,400])
    const rotated=await parallel.find(response=>response.status===200)!.json()
    expect((await fetch(fixture.origin+"/mcp",{headers:{authorization:`Bearer ${rotated.access_token}`}})).status).toBe(401)
    expect((await token({...refresh,refresh_token:rotated.refresh_token})).status).toBe(400)
    const revoked=await fixture.authorize(owner.cookie,"Revoked agent")
    const connections=await (await fixture.json("/api/agents",undefined,owner.cookie)).json(),connection=connections.find((entry:{name:string})=>entry.name==="Revoked agent")
    expect((await fixture.json(`/api/agents/${connection.id}/revoke`,{},owner.cookie)).status).toBe(200)
    expect((await token({...refresh,client_id:revoked.registered.client_id,refresh_token:revoked.tokens.refresh_token})).status).toBe(400)
    const expired=await begin(),expiredIntent=new URL(expired.headers.get("location")!).searchParams.get("intent")!
    fixture.advance(25*3600000)
    const context=await (await fixture.json("/api/agents/approval?intent="+encodeURIComponent(expiredIntent),undefined,owner.cookie)).json()
    expect(context).toMatchObject({client:"Local reference agent",scope:"decks",expired:true})
    const restart=new URL(context.restart,fixture.origin)
    expect(restart.searchParams.get("redirect_uri")).toBe(authorized.registered.redirect_uris[0])
    expect(restart.searchParams.get("code_challenge")).toBe(authorized.params.get("code_challenge"))
    expect((await fixture.json("/api/agents/approval",{intent:expiredIntent,allow:true},owner.cookie)).status).toBe(400)
    const idle=await fixture.authorize(owner.cookie,"Idle agent")
    fixture.advance(30*86400000)
    expect((await token({...refresh,client_id:idle.registered.client_id,refresh_token:idle.tokens.refresh_token})).status).toBe(400)
  }finally{await fixture.close()}
},60000)
