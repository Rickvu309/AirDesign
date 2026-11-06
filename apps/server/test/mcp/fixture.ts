import {mkdtemp,rm} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {randomBytes,createHash} from "node:crypto"
import {createServer} from "node:net"
import pg from "pg"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {startServer} from "../../src/main.ts"
import {createHistoryStore} from "../../src/db/history-store.ts"
export async function mcpFixture(options:{publicOrigin?:string}={}){
  const database=`airdesign_p07_mcp_${randomBytes(6).toString("hex")}`,host=process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock",user=process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin=new pg.Client({host,user,database:"postgres"});await admin.connect();await admin.query(`CREATE DATABASE ${database}`)
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,"127.0.0.1",resolve));const address=probe.address();if(!address||typeof address==="string")throw new Error("port-missing");const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()))
  const apiOrigin=`http://127.0.0.1:${port}`,origin=options.publicOrigin ?? apiOrigin,url=`postgresql://${user}@/${database}?host=${host}`,previous={database:process.env.AIRDESIGN_DATABASE_URL,inbox:process.env.AIRDESIGN_EXPOSE_INBOX}
  let now=Date.parse("2026-11-06T03:00:00Z")
  process.env.AIRDESIGN_DATABASE_URL=url;process.env.AIRDESIGN_EXPOSE_INBOX="1"
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/airdesign-p07-")),operationsPath=path.join(directory,"operations.sqlite")
  const history=await createHistoryStore({kind:"postgres",url},()=>now)
  const server=await startServer(port,{publicOrigin:origin,clock:()=>now,operationsPath,templatesPath:path.join(directory,"templates.sqlite")})
  const clients:Client[]=[]
  async function json(path:string,body?:unknown,cookie=""){
    return fetch(apiOrigin+path,{method:body===undefined ? "GET" : "POST",headers:{origin,cookie,"content-type":"application/json"},body:body===undefined ? undefined : JSON.stringify(body),redirect:"manual"})
  }
  async function signIn(email:string){
    let cookie=""
    async function call(path:string,body:unknown){const response=await json(path,body,cookie);const jar=new Map(cookie.split("; ").filter(Boolean).map(pair=>{const i=pair.indexOf("=");return [pair.slice(0,i),pair.slice(i+1)]}));for(const value of response.headers.getSetCookie()){const pair=value.split(";")[0] ?? "",i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1))}cookie=[...jar].map(([k,v])=>`${k}=${v}`).join("; ");return response.json()}
    const intent=await call("/api/access/intent",{kind:"home"});await call("/api/access/email",{email,intent:intent.token});const inbox=await (await json(`/api/dev/inbox?to=${encodeURIComponent(email)}`)).json();const signed=await call("/api/access/code",{email,intent:intent.token,code:inbox.messages.at(-1).code});if(signed.status!=="signed-in")throw new Error("sign-in-failed");return {cookie,personId:String(signed.personId)}
  }
  async function authorize(cookie:string,name="Local reference agent"){
    const registered=await (await json("/oauth/register",{client_name:name,redirect_uris:["http://127.0.0.1:49199/callback"],token_endpoint_auth_method:"none"})).json()
    const verifier=randomBytes(32).toString("base64url"),params=new URLSearchParams({client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",resource:origin+"/mcp",scope:"decks",response_type:"code",state:"local-reference-state"})
    const response=await fetch(apiOrigin+"/oauth/authorize?"+params,{redirect:"manual"});const approvalUrl=new URL(response.headers.get("location") ?? "invalid",origin),intent=approvalUrl.searchParams.get("intent");if(!intent)throw new Error("approval-not-issued")
    const decision=await (await json("/api/agents/approval",{intent,allow:true},cookie)).json(),redirect=new URL(decision.redirect)
    const form={grant_type:"authorization_code",client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code:redirect.searchParams.get("code") ?? "",code_verifier:verifier,resource:origin+"/mcp"}
    const tokens=await (await fetch(apiOrigin+"/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(form)})).json()
    if(!tokens.access_token)throw new Error("token-not-issued")
    const client=new Client({name:"AirDesign local reference",version:"0.1.0"});clients.push(client);await client.connect(new StreamableHTTPClientTransport(new URL(origin+"/mcp"),{requestInit:{headers:{authorization:`Bearer ${tokens.access_token}`}}}))
    return {client,tokens,registered,intent,params,form,approvalUrl:approvalUrl.href}
  }
  return {origin,apiOrigin,url,directory,operationsPath,history,json,signIn,authorize,now:()=>now,advance:(ms:number)=>{now+=ms},async close(){await Promise.all(clients.map(client=>client.close()));await server.close();await history.close();if(previous.database===undefined)delete process.env.AIRDESIGN_DATABASE_URL;else process.env.AIRDESIGN_DATABASE_URL=previous.database;if(previous.inbox===undefined)delete process.env.AIRDESIGN_EXPOSE_INBOX;else process.env.AIRDESIGN_EXPOSE_INBOX=previous.inbox;await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await admin.end();await rm(directory,{recursive:true,force:true})}}
}
export function toolValue(result:Awaited<ReturnType<Client["callTool"]>>){if(!Array.isArray(result.content))throw new Error("missing-content");const text=result.content.find(item=>item.type==="text");if(!text||typeof text.text!=="string")throw new Error("missing-text");const envelope=JSON.parse(text.text);return envelope.ok ? envelope.data : envelope.error.details}
