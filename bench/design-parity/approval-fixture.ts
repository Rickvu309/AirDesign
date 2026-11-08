import {createHash} from "node:crypto"
import {z} from "zod"

export async function approvalRoute(origin:string,apiOrigin:string,name:string):Promise<string>{
  const registration=await fetch(apiOrigin+"/oauth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({client_name:name,redirect_uris:["http://127.0.0.1:49199/callback"],token_endpoint_auth_method:"none"})})
  if(registration.status!==201)throw new Error("approval-registration-failed")
  const registered=z.object({client_id:z.string(),redirect_uris:z.tuple([z.string()]).rest(z.string())}).parse(await registration.json())
  const params=new URLSearchParams({client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code_challenge:createHash("sha256").update("design-parity-verifier".repeat(3)).digest("base64url"),code_challenge_method:"S256",resource:origin+"/mcp",scope:"decks",response_type:"code",state:"design-parity"})
  const response=await fetch(apiOrigin+"/oauth/authorize?"+params,{redirect:"manual"})
  if(response.status!==302)throw new Error("approval-not-issued")
  const route=new URL(z.string().parse(response.headers.get("location")),origin)
  return route.pathname+route.search
}
