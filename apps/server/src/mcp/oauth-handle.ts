import {mutationRejection,type Access} from "@airdesign/access"
import type {HistoryStore} from "../db/history-store.ts"
export function oauthHandler(access:Access,history:HistoryStore,origin:string,secret:string) {
  const resource=`${origin}/mcp`,store=history.oauth(secret,resource)
  return async(request:Request):Promise<Response>=>{
    const url=new URL(request.url),path=url.pathname
    const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}})
    if(request.headers.get("origin") && request.headers.get("origin")!==origin)return reply({error:"invalid_request"},403)
    try {
      if(path==="/.well-known/oauth-protected-resource" || path==="/.well-known/oauth-protected-resource/mcp")return reply({resource,authorization_servers:[origin],scopes_supported:["decks"],bearer_methods_supported:["header"]})
      if(path==="/.well-known/oauth-authorization-server")return reply({issuer:origin,authorization_endpoint:`${origin}/oauth/authorize`,token_endpoint:`${origin}/oauth/token`,registration_endpoint:`${origin}/oauth/register`,revocation_endpoint:`${origin}/oauth/revoke`,response_types_supported:["code"],grant_types_supported:["authorization_code","refresh_token"],token_endpoint_auth_methods_supported:["none"],code_challenge_methods_supported:["S256"],scopes_supported:["decks"]})
      if(path==="/oauth/authorize" && request.method==="GET"){
        const get=(key:string)=>url.searchParams.get(key) ?? ""
        const approval=await store.authorize({client:get("client_id"),redirect:get("redirect_uri"),challenge:get("code_challenge"),resource:get("resource"),scope:get("scope"),state:get("state"),method:get("code_challenge_method"),responseType:get("response_type")})
        return Response.redirect(`${origin}/agents/approve?intent=${encodeURIComponent(approval.intent)}`,302)
      }
      if(path==="/oauth/register" && request.method==="POST"){
        const body:unknown=await request.json()
        if(!body||typeof body!=="object"||!("client_name" in body)||typeof body.client_name!=="string"||!("redirect_uris" in body)||!Array.isArray(body.redirect_uris)||body.redirect_uris.some((value:unknown)=>typeof value!=="string")||("token_endpoint_auth_method" in body && body.token_endpoint_auth_method!=="none"))return reply({error:"invalid_client_metadata"},400)
        const redirects=body.redirect_uris.map((value:unknown)=>{if(typeof value!=="string")throw new Error("invalid-client-metadata");return value})
        return reply(await store.register({name:body.client_name,redirects}),201)
      }
      if(path==="/oauth/token" && request.method==="POST"){
        if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))return reply({error:"invalid_request"},400)
        const form=new URLSearchParams(await request.text()),get=(key:string)=>form.get(key) ?? ""
        const result=get("grant_type")==="authorization_code" ? await store.exchange({code:get("code"),verifier:get("code_verifier"),client:get("client_id"),redirect:get("redirect_uri"),resource:get("resource")}) : get("grant_type")==="refresh_token" ? await store.refresh({refresh:get("refresh_token"),client:get("client_id"),resource:get("resource")}) : null
        return result ? reply(result) : reply({error:"invalid_grant"},400)
      }
      if(path==="/oauth/revoke" && request.method==="POST"){
        const form=new URLSearchParams(await request.text())
        await store.revokeToken(form.get("token") ?? "",form.get("client_id") ?? "")
        return new Response(null,{status:200})
      }
      const rejection=mutationRejection(request,origin);if(rejection)return reply(rejection,rejection.status)
      const principal=await access.principal(request);if(!principal)return reply({code:"signed-out"},401)
      if(path==="/api/agents" && request.method==="GET")return reply(await store.list(principal.personId))
      if(path==="/api/agents/approval" && request.method==="GET"){
        const approval=await store.approval(url.searchParams.get("intent") ?? "")
        return approval ? reply(approval) : reply({code:"approval-expired"},410)
      }
      if(path==="/api/agents/approval" && request.method==="POST"){
        const body:unknown=await request.json()
        if(!body||typeof body!=="object"||!("intent" in body)||typeof body.intent!=="string"||!("allow" in body)||typeof body.allow!=="boolean"||Object.keys(body).some(key=>key!=="intent"&&key!=="allow"))return reply({code:"invalid-approval"},400)
        return reply({redirect:await store.decide(principal.personId,body.intent,body.allow)})
      }
      const revoke=/^\/api\/agents\/([a-f0-9-]{36})\/revoke$/.exec(path)
      if(revoke?.[1] && request.method==="POST"){await store.revoke(principal.personId,revoke[1]);return reply({revoked:true})}
      return reply({code:"not-found"},404)
    } catch(error){return reply({error:"invalid_request",code:error instanceof Error ? error.message : "oauth-failed"},400)}
  }
}
