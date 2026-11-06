import { randomBytes } from "node:crypto"
import pg from "pg"
import { expect, it } from "vitest"
import { createAccess, createMemoryInbox } from "../../../packages/access/src/index.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { commandsHandler } from "../src/commands/handle.ts"
import { createHistoryStore } from "../src/db/history-store.ts"

it("orders two authenticated command clients on separate connections and denies every cross-owner path", async () => {
  const database = `airdesign_p04_api_${randomBytes(5).toString("hex")}`
  const host = process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock"
  const user = process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin = new pg.Client({host,user,database:"postgres"})
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  const url = `postgresql://${user}@/${database}?host=${host}`
  const inbox = createMemoryInbox()
  const origin = "http://127.0.0.1:41732"
  const access = await createAccess({driver:{kind:"postgres",url},secret:"p04-test-secret-at-least-32-characters",mail:inbox,clock:()=>Date.now(),guard:{allow:()=>true},exposeInbox:false,publicOrigin:origin})
  const first = await createHistoryStore({kind:"postgres",url})
  const second = await createHistoryStore({kind:"postgres",url})
  const a = commandsHandler(access,first,origin), b = commandsHandler(access,second,origin)
  async function signIn(email: string) {
    let cookie = ""
    async function call(path: string, body: unknown) {
      const response = await access.handle(new Request(origin+path,{method:"POST",headers:{origin,"content-type":"application/json",cookie},body:JSON.stringify(body)}))
      const jar = new Map(cookie.split("; ").filter(Boolean).map(pair=>{const split=pair.indexOf("=");return [pair.slice(0,split),pair.slice(split+1)]}))
      for (const value of response.headers.getSetCookie()) { const pair=value.split(";")[0] ?? "";const split=pair.indexOf("=");jar.set(pair.slice(0,split),pair.slice(split+1)) }
      cookie = [...jar].map(([key,value])=>`${key}=${value}`).join("; ")
      return response.json()
    }
    const intent = await call("/api/access/intent",{kind:"home"})
    await call("/api/access/email",{email,intent:intent.token})
    const signed = await call("/api/access/code",{email,intent:intent.token,code:inbox.read(email).at(-1)?.code})
    expect(signed.status).toBe("signed-in")
    return cookie
  }
  function request(cookie: string, path: string, method="GET", body?: unknown) { return new Request(origin+path,{method,headers:{origin,cookie,"content-type":"application/json"},body:body===undefined ? undefined : JSON.stringify(body)}) }
  try {
    const owner = await signIn("owner@example.com"), stranger = await signIn("stranger@example.com")
    expect((await a(request(owner,"/api/decks","POST",fixtureDeck(2)))).status).toBe(201)
    const command = {id:"same-request",kind:"patch",base:0,run:null,target:"s0",fields:{notes:"durable"},personId:"forged"}
    const [left,right] = await Promise.all([a(request(owner,"/api/decks/deck/commands","POST",command)),b(request(owner,"/api/decks/deck/commands","POST",command))])
    expect(await left.json()).toEqual(await right.json())
    expect(await (await b(request(owner,"/api/decks/deck/events"))).json()).toMatchObject({head:1,events:[{seq:1,command:{id:"same-request"}}]})
    expect(await (await a(request(owner,"/api/decks/deck/commands","POST",{...command,fields:{notes:"mismatch"}}))).json()).toEqual({code:"request-id-payload-mismatch"})
    for (const [path,method,body] of [["/api/decks/deck","GET",undefined],["/api/decks/deck/events","GET",undefined],["/api/decks/deck/commands","POST",command],["/api/decks/deck","DELETE",undefined]] as const) expect((await b(request(stranger,path,method,body))).status).toBe(404)
    expect((await b(request("","/api/decks/deck/commands","POST",command))).status).toBe(401)
    expect((await b(new Request(origin+"/api/decks/deck/commands",{method:"POST",headers:{cookie:owner,origin:"https://attacker.invalid","content-type":"application/json"},body:JSON.stringify(command)}))).status).toBe(403)
    await first.close()
    const restarted = await createHistoryStore({kind:"postgres",url})
    try {
      const resume = commandsHandler(access,restarted,origin)
      expect(await (await resume(request(owner,"/api/decks/deck"))).json()).toMatchObject({seq:1,deck:{slides:[{notes:"durable"}]}})
      expect(await (await resume(request(owner,"/api/decks/deck/commands","POST",command))).json()).toMatchObject({kind:"applied",seq:1})
    } finally { await restarted.close() }
  } finally {
    await first.close();await second.close();await access.close()
    expect((await admin.query(`DROP DATABASE ${database}`)).command).toBe("DROP")
    await admin.end()
  }
},30_000)
