import { createHash } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { expect, it } from "vitest"
import { initializeOAuth, oauthStore } from "../../src/oauth/store.ts"
it("binds PKCE, redirect, audience and consent, rotates once and revokes on refresh reuse",async()=>{
  const database=new PGlite()
  let now=Date.parse("2026-11-06T03:00:00Z")
  await initializeOAuth(database)
  const store=oauthStore(work=>database.transaction(work),"test-secret-with-at-least-32-characters",{resource:"http://127.0.0.1/mcp",issuer:"http://127.0.0.1"},()=>now)
  try {
    const registered=await store.register({name:"Reference client",redirects:["http://127.0.0.1:5912/return"]})
    const verifier="a".repeat(64),challenge=createHash("sha256").update(verifier).digest("base64url")
    const request={client:registered.client_id,redirect:registered.redirect_uris[0]!,challenge,resource:store.resource,scope:"decks",state:"request-1",method:"S256",responseType:"code"}
    await expect(store.authorize({...request,redirect:"http://attacker.invalid/return"})).rejects.toThrow("invalid-redirect-uri")
    await expect(store.authorize({...request,method:"plain"})).rejects.toThrow("invalid-authorization-request")
    const approval=await store.authorize(request)
    expect(await store.approval(approval.intent)).toEqual({client:"Reference client",scope:"decks",expired:false})
    const redirect=new URL(await store.decide("owner",approval.intent,true))
    expect(redirect.searchParams.get("state")).toBe("request-1")
    const code=redirect.searchParams.get("code")!
    const input={code,verifier,client:request.client,redirect:request.redirect,resource:store.resource}
    expect(await store.exchange({...input,verifier:"b".repeat(64)})).toBeNull()
    expect(await store.exchange({...input,resource:"http://127.0.0.1/other"})).toBeNull()
    const issued=await store.exchange(input)
    expect(issued).not.toBeNull()
    if(!issued)throw new Error("expected-tokens")
    expect(await store.exchange(input)).toBeNull()
    expect(await store.authenticate(issued.access_token,store.resource)).toMatchObject({personId:"owner"})
    expect(await store.authenticate(issued.access_token,"http://127.0.0.1/other")).toBeNull()
    const refresh={refresh:issued.refresh_token,client:request.client,resource:store.resource}
    const results=await Promise.all([store.refresh(refresh),store.refresh(refresh)])
    expect(results.filter(Boolean)).toHaveLength(1)
    const rotated=results.find(Boolean)!
    expect(await store.authenticate(rotated.access_token,store.resource)).toBeNull()
    expect(await store.refresh({...refresh,refresh:rotated.refresh_token})).toBeNull()
    const next=await store.authorize(request)
    const nextCode=new URL(await store.decide("owner",next.intent,true)).searchParams.get("code")!
    const active=await store.exchange({...input,code:nextCode})
    if(!active)throw new Error("expected-tokens")
    const connections=await store.list("owner")
    const id=connections.find(value=>!value.revoked)!.id
    await expect(store.revoke("other",id)).rejects.toThrow("connection-not-found")
    await Promise.all([store.revoke("owner",id),store.revoke("owner",id)])
    expect(await store.authenticate(active.access_token,store.resource)).toBeNull()
    const expired=await store.authorize(request)
    now=expired.expiresAt
    expect(await store.approval(expired.intent)).toMatchObject({client:"Reference client",scope:"decks",expired:true,restart:expect.stringContaining("client_id=")})
    await expect(store.decide("owner",expired.intent,true)).rejects.toThrow("approval-expired")
    const idle=await store.authorize(request)
    const idleCode=new URL(await store.decide("owner",idle.intent,true)).searchParams.get("code")!
    const unused=await store.exchange({...input,code:idleCode})
    now+=30*86400000
    expect(await store.refresh({...refresh,refresh:unused!.refresh_token})).toBeNull()
  }finally{await database.close()}
})
