import {createHash} from "node:crypto"
import {expect,it,vi} from "vitest"
import {mcpFixture} from "./fixture.ts"

it.each([false,true])("binds the real OAuth callback issuer independently of resource origin (split=%s)",async split=>{
  const studio="https://studio.example.invalid",mcp=split ? "https://mcp.example.invalid" : studio
  vi.stubEnv("AIRDESIGN_MCP_ORIGIN",mcp)
  try{
    const fixture=await mcpFixture({publicOrigin:studio})
    try{
      const owner=await fixture.signIn("issuer-owner@example.com")
      const metadata=await (await fixture.json("/.well-known/oauth-authorization-server")).json()
      const protectedResource=await (await fixture.json("/.well-known/oauth-protected-resource")).json()
      expect(metadata.issuer).toBe(studio)
      expect(protectedResource).toMatchObject({resource:mcp+"/mcp",authorization_servers:[studio]})
      const registered=await (await fixture.json("/oauth/register",{client_name:"Issuer validating client",redirect_uris:["http://127.0.0.1:49199/callback"]})).json()
      const verifier="v".repeat(64),resource=mcp+"/mcp"
      const params=new URLSearchParams({client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",resource,scope:"decks",response_type:"code",state:"issuer-state"})
      async function decide(allow:boolean){
        const begun=await fetch(fixture.apiOrigin+"/oauth/authorize?"+params,{redirect:"manual"})
        expect(begun.status).toBe(302)
        const approval=new URL(begun.headers.get("location")!)
        expect(approval.origin).toBe(studio)
        const decision=await fixture.json("/api/agents/approval",{intent:approval.searchParams.get("intent"),allow},owner.cookie)
        expect(decision.status).toBe(200)
        return new URL((await decision.json()).redirect)
      }
      const approved=await decide(true),denied=await decide(false)
      const form={grant_type:"authorization_code",client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code:approved.searchParams.get("code")!,code_verifier:verifier,resource}
      async function exchange(audience:string){return fetch(fixture.apiOrigin+"/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...form,resource:audience})})}
      expect((await exchange(studio+"/wrong")).status).toBe(400)
      if(split)expect((await exchange(studio+"/mcp")).status).toBe(400)
      const issued=await exchange(resource)
      expect(issued.status).toBe(200)
      expect((await issued.json()).access_token).toBeTruthy()
      for(const redirect of [approved,denied]){
        expect(redirect.origin+redirect.pathname).toBe(registered.redirect_uris[0])
        expect(redirect.searchParams.get("state")).toBe("issuer-state")
        expect(redirect.searchParams.get("iss")).toBe(metadata.issuer)
      }
      expect(denied.searchParams.get("error")).toBe("access_denied")
    }finally{await fixture.close()}
  }finally{vi.unstubAllEnvs()}
})
