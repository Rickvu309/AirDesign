import { createHash, randomBytes, randomUUID } from "node:crypto"
import { issueIntent, usableIntent } from "../intent-token.ts"
export const oauthPolicy = { scope: "decks", accessMs: 900000, idleMs: 30 * 86400000, codeMs: 60000 } as const
export type OAuthTransaction = { query: <R>(sql: string, params?: unknown[]) => Promise<{rows:R[]}> }
type Transactions = <T>(work:(tx:OAuthTransaction)=>Promise<T>)=>Promise<T>
type Client = { name: string; redirects: string[] }
type Approval = { client: string; redirect: string; challenge: string; resource: string; state: string; owner: string | null; decision: "pending" | "approved" | "denied" }
type Code = { approval: Approval; expires: number; consumed: boolean }
type Connection = { id: string; owner: string; client: string; name: string; resource: string; lastUsed: number; revoked: boolean; access: string; accessExpires: number }
const hash = (value:string)=>createHash("sha256").update(value).digest("base64url")
const token = ()=>randomBytes(32).toString("base64url")
export async function initializeOAuth(tx:OAuthTransaction) {
  await tx.query("CREATE TABLE IF NOT EXISTS oauth_client (id text PRIMARY KEY, data jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS oauth_approval (id text PRIMARY KEY, data jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS oauth_code (id text PRIMARY KEY, data jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS oauth_connection (id text PRIMARY KEY, data jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS oauth_refresh (id text PRIMARY KEY, connection text NOT NULL REFERENCES oauth_connection(id), used boolean NOT NULL DEFAULT false)")
}
function validRedirect(value:string) {
  const url=new URL(value)
  return !url.username && !url.password && !url.hash && (url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1","[::1]","localhost"].includes(url.hostname))
}
export function oauthStore(transaction:Transactions, secret:string, resource:string, clock=Date.now) {
  async function client(tx:OAuthTransaction,id:string) {
    const found=(await tx.query<{data:Client}>("SELECT data FROM oauth_client WHERE id=$1",[id])).rows[0]?.data
    if(!found)throw new Error("invalid-client")
    return found
  }
  async function connection(tx:OAuthTransaction,id:string) {
    return (await tx.query<{data:Connection}>("SELECT data FROM oauth_connection WHERE id=$1 FOR UPDATE",[id])).rows[0]?.data
  }
  async function save(tx:OAuthTransaction,value:Connection) {
    await tx.query("UPDATE oauth_connection SET data=$2 WHERE id=$1",[value.id,JSON.stringify(value)])
  }
  async function tokens(tx:OAuthTransaction,value:Connection) {
    const access=token(),refresh=token()
    value.access=hash(access)
    value.accessExpires=clock()+oauthPolicy.accessMs
    value.lastUsed=clock()
    await save(tx,value)
    await tx.query("INSERT INTO oauth_refresh(id,connection) VALUES ($1,$2)",[hash(refresh),value.id])
    return {access_token:access,refresh_token:refresh,token_type:"Bearer",expires_in:oauthPolicy.accessMs/1000,scope:oauthPolicy.scope}
  }
  return {
    resource,
    async register(input:{name:string;redirects:string[]}) {
      if(!input.name || input.name.length>100 || !input.redirects.length || input.redirects.length>10 || input.redirects.some(uri=>uri.length>2048 || !validRedirect(uri)))throw new Error("invalid-client-metadata")
      return transaction(async tx=>{
        const id=randomUUID()
        await tx.query("INSERT INTO oauth_client(id,data) VALUES ($1,$2)",[id,JSON.stringify(input)])
        return {client_id:id,client_name:input.name,redirect_uris:input.redirects,token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],response_types:["code"]}
      })
    },
    async authorize(input:{client:string;redirect:string;challenge:string;resource:string;scope:string;state:string;method:string;responseType:string}) {
      if(input.resource!==resource || input.scope!==oauthPolicy.scope || input.method!=="S256" || input.responseType!=="code" || !/^[A-Za-z0-9_-]{43}$/.test(input.challenge) || input.state.length>1024)throw new Error("invalid-authorization-request")
      return transaction(async tx=>{
        const registered=await client(tx,input.client)
        if(!registered.redirects.includes(input.redirect))throw new Error("invalid-redirect-uri")
        const intent=issueIntent(secret,"connect-agent",clock())
        const approval:Approval={...input,owner:null,decision:"pending"}
        await tx.query("INSERT INTO oauth_approval(id,data) VALUES ($1,$2)",[hash(intent.token),JSON.stringify(approval)])
        return {intent:intent.token,expiresAt:intent.exp,client:registered.name}
      })
    },
    async approval(intent:string) {
      return transaction(async tx=>{
        const approval=(await tx.query<{data:Approval}>("SELECT data FROM oauth_approval WHERE id=$1",[hash(intent)])).rows[0]?.data
        if(!approval || approval.decision!=="pending")return null
        const expired=usableIntent(secret,intent,clock())?.kind!=="connect-agent"
        const restart=new URL("/oauth/authorize",new URL(resource).origin)
        for(const [key,value] of Object.entries({client_id:approval.client,redirect_uri:approval.redirect,code_challenge:approval.challenge,resource:approval.resource,scope:oauthPolicy.scope,state:approval.state,code_challenge_method:"S256",response_type:"code"}))restart.searchParams.set(key,value)
        return {client:(await client(tx,approval.client)).name,scope:oauthPolicy.scope,expired,...(expired ? {restart:restart.href} : {})}
      })
    },
    async decide(owner:string,intent:string,allow:boolean) {
      if(usableIntent(secret,intent,clock())?.kind!=="connect-agent")throw new Error("approval-expired")
      return transaction(async tx=>{
        const approval=(await tx.query<{data:Approval}>("SELECT data FROM oauth_approval WHERE id=$1 FOR UPDATE",[hash(intent)])).rows[0]?.data
        if(!approval || approval.decision!=="pending")throw new Error("approval-expired")
        approval.owner=owner
        approval.decision=allow ? "approved" : "denied"
        await tx.query("UPDATE oauth_approval SET data=$2 WHERE id=$1",[hash(intent),JSON.stringify(approval)])
        const redirect=new URL(approval.redirect)
        if(approval.state)redirect.searchParams.set("state",approval.state)
        redirect.searchParams.set("iss",new URL(resource).origin)
        if(!allow)redirect.searchParams.set("error","access_denied")
        else {
          const code=token()
          const value:Code={approval,expires:clock()+oauthPolicy.codeMs,consumed:false}
          await tx.query("INSERT INTO oauth_code(id,data) VALUES ($1,$2)",[hash(code),JSON.stringify(value)])
          redirect.searchParams.set("code",code)
        }
        return redirect.href
      })
    },
    async exchange(input:{code:string;verifier:string;client:string;redirect:string;resource:string}) {
      if(!/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier))return null
      return transaction(async tx=>{
        const code=(await tx.query<{data:Code}>("SELECT data FROM oauth_code WHERE id=$1 FOR UPDATE",[hash(input.code)])).rows[0]?.data
        if(!code || code.consumed || code.expires<=clock() || code.approval.client!==input.client || code.approval.redirect!==input.redirect || code.approval.resource!==input.resource || input.resource!==resource || hash(input.verifier)!==code.approval.challenge || !code.approval.owner)return null
        code.consumed=true
        await tx.query("UPDATE oauth_code SET data=$2 WHERE id=$1",[hash(input.code),JSON.stringify(code)])
        const registered=await client(tx,input.client)
        const value:Connection={id:randomUUID(),owner:code.approval.owner,client:input.client,name:registered.name,resource,lastUsed:clock(),revoked:false,access:"",accessExpires:0}
        await tx.query("INSERT INTO oauth_connection(id,data) VALUES ($1,$2)",[value.id,JSON.stringify(value)])
        return tokens(tx,value)
      })
    },
    async refresh(input:{refresh:string;client:string;resource:string}) {
      return transaction(async tx=>{
        const refresh=(await tx.query<{connection:string;used:boolean}>("SELECT connection,used FROM oauth_refresh WHERE id=$1 FOR UPDATE",[hash(input.refresh)])).rows[0]
        if(!refresh)return null
        const value=await connection(tx,refresh.connection)
        if(!value || value.client!==input.client || value.resource!==input.resource || input.resource!==resource)return null
        if(refresh.used) {value.revoked=true;await save(tx,value);return null}
        if(value.revoked || clock()-value.lastUsed>=oauthPolicy.idleMs)return null
        await tx.query("UPDATE oauth_refresh SET used=true WHERE id=$1",[hash(input.refresh)])
        return tokens(tx,value)
      })
    },
    async authenticate(access:string,audience:string) {
      if(audience!==resource)return null
      return transaction(async tx=>{
        const row=(await tx.query<{id:string}>("SELECT id FROM oauth_connection WHERE data->>'access'=$1",[hash(access)])).rows[0]
        if(!row)return null
        const value=await connection(tx,row.id)
        if(!value || value.revoked || value.resource!==audience || value.access!==hash(access) || value.accessExpires<=clock() || clock()-value.lastUsed>=oauthPolicy.idleMs)return null
        value.lastUsed=clock()
        await save(tx,value)
        return {personId:value.owner,connection:value.id,scope:oauthPolicy.scope}
      })
    },
    async list(owner:string) {
      return transaction(async tx=>(await tx.query<{data:Connection}>("SELECT data FROM oauth_connection WHERE data->>'owner'=$1 ORDER BY id LIMIT 100",[owner])).rows.map(({data})=>({id:data.id,name:data.name,lastUsed:data.lastUsed,revoked:data.revoked,expired:clock()-data.lastUsed>=oauthPolicy.idleMs})))
    },
    async revokeToken(value:string,clientId:string) {
      return transaction(async tx=>{
        const digest=hash(value)
        const match=(await tx.query<{id:string}>("SELECT c.id FROM oauth_connection c LEFT JOIN oauth_refresh r ON r.connection=c.id WHERE c.data->>'client'=$1 AND (c.data->>'access'=$2 OR r.id=$2) LIMIT 1",[clientId,digest])).rows[0]
        if(match){const connection=(await tx.query<{data:Connection}>("SELECT data FROM oauth_connection WHERE id=$1 FOR UPDATE",[match.id])).rows[0]?.data;if(connection){connection.revoked=true;await save(tx,connection)}}
      })
    },
    async revoke(owner:string,id:string) {
      return transaction(async tx=>{
        const value=await connection(tx,id)
        if(!value || value.owner!==owner)throw new Error("connection-not-found")
        value.revoked=true
        await save(tx,value)
      })
    },
  }
}
