import { createServer } from "node:http"
import { once } from "node:events"
import { WebSocket } from "ws"
import type { Access } from "../../../packages/access/src/index.ts"
import { attachSync } from "../src/rpc/websocket.ts"
import { commandsHandler } from "../src/commands/handle.ts"
import { randomBytes } from "node:crypto"
import pg from "pg"
import { expect,it,vi } from "vitest"
import { createHistoryStore,type HistoryStore } from "../src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { id } from "../../../packages/deck/src/index.ts"
import { commandId,type Command } from "../../../packages/change-log/src/index.ts"
import { syncErrorCode } from "../../../packages/rpc/src/sync-error.ts"

async function databaseTest(work:(driver:{kind:"postgres";url:string},sql:pg.Client,stores:HistoryStore[])=>Promise<void>){
  const database=`airdesign_deadlock_${randomBytes(6).toString("hex")}`
  const host=process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock",user=process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin=new pg.Client({host,user,database:"postgres"}),stores:HistoryStore[]=[]
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  await admin.query(`ALTER DATABASE ${database} SET deadlock_timeout='100ms'`)
  await admin.query(`ALTER DATABASE ${database} SET log_lock_waits=on`)
  const driver={kind:"postgres",url:`postgresql://${user}@/${database}?host=${host}`} as const
  const sql=new pg.Client({connectionString:driver.url})
  await sql.connect()
  try {await work(driver,sql,stores)} finally {
    vi.restoreAllMocks()
    await sql.query("ROLLBACK")
    await sql.end()
    await Promise.all(stores.map(store=>store.close()))
    await admin.query(`DROP DATABASE ${database}`)
    await admin.end()
  }
}
const owner={personId:"owner"}
const noWait={budgetMs:0,firstDelayMs:1,maxDelayMs:1}
const patch=(name:string):Command=>({id:commandId(name),kind:"patch",target:id("s0"),fields:{notes:name},base:0,run:null})

it("lets a save finish while a worker initializes history on another PostgreSQL connection",async()=>{
  await databaseTest(async(driver,sql,stores)=>{
    const first=await createHistoryStore(driver);stores.push(first)
    const deck=fixtureDeck(2)
    await first.create(owner,deck)
    await sql.query("UPDATE schema_version SET version=0 WHERE name='history'")
    await sql.query("BEGIN")
    await sql.query("SELECT state FROM editing_deck WHERE id=$1 FOR UPDATE",[deck.id])
    let unblock:(()=>void)|undefined
    const startupWaiting=new Promise<void>(resolve=>{unblock=resolve})
    let deadlocks=0
    const original=pg.Client.prototype.query
    const observed=vi.spyOn(pg.Client.prototype,"query")
    observed.mockImplementation(function(this:pg.Client,...args:Parameters<typeof original>){
      const result:unknown=Reflect.apply(original,this,args)
      if(result instanceof Promise)void result.catch((error:unknown)=>{if(error && typeof error==="object" && "code" in error && error.code==="40P01")deadlocks++})
      const query=args[0]
      if(typeof query==="string" && (query.startsWith("ALTER TABLE editing_deck") || query.startsWith("LOCK TABLE editing_deck")))unblock?.()
      return result
    })
    const opening=createHistoryStore(driver).then(store=>{stores.push(store);return store})
    await startupWaiting
    const saving=(async()=>{
      await sql.query("INSERT INTO editing_event(deck,seq,command,receipt) VALUES($1,1,$2,$3)",[deck.id,JSON.stringify(patch("startup_race")),JSON.stringify({kind:"applied",id:"startup_race",seq:1})])
      await sql.query("COMMIT")
    })()
    const outcomes=await Promise.allSettled([opening,saving])
    expect(outcomes.map(result=>result.status)).toEqual(["fulfilled","fulfilled"])
    expect(deadlocks).toBe(0)
    expect((await sql.query("SELECT count(*)::integer AS count FROM editing_event WHERE deck=$1",[deck.id])).rows).toEqual([{count:1}])
    observed.mockRestore()
  })
},30_000)

it("opens current schemas without DDL and lets a save finish during twenty worker cycles",async()=>{
  await databaseTest(async(driver,sql,stores)=>{
    await sql.query("ALTER DATABASE "+(await sql.query("SELECT current_database() AS name")).rows[0].name+" SET lock_timeout='50ms'")
    const first=await createHistoryStore(driver);stores.push(first)
    const deck=fixtureDeck(2);await first.create(owner,deck)
    let releaseSave:()=>void=()=>undefined
    let saveStarted:()=>void=()=>undefined
    const saveGate=new Promise<void>(resolve=>{releaseSave=resolve})
    const savingStarted=new Promise<void>(resolve=>{saveStarted=resolve})
    const statements:string[]=[]
    const original=pg.Client.prototype.query
    const observed=vi.spyOn(pg.Client.prototype,"query")
    observed.mockImplementation(function(this:pg.Client,...args:Parameters<typeof original>){
      if(typeof args[0]==="string")statements.push(args[0])
      const result=Reflect.apply(original,this,args)
      if(typeof args[0]==="string" && args[0].startsWith("INSERT INTO editing_event"))return Promise.resolve(result).then(async value=>{saveStarted();await saveGate;return value})
      return result
    })
    const saving=first.commit(owner,deck.id,patch("worker_cycles"))
    await savingStarted
    try {
      for(let cycle=0;cycle<20;cycle++){
        const worker=await createHistoryStore({...driver,schema:"connect"})
        await worker.close()
      }
      const current=await createHistoryStore({...driver,schema:"migrate"});await current.close()
      releaseSave()
      await expect(saving).resolves.toMatchObject({kind:"applied",seq:1})
      expect(statements.filter(sql=>/^\s*(CREATE|ALTER|DROP|LOCK|TRUNCATE|REINDEX)\b/i.test(sql))).toEqual([])
      expect(statements.filter(sql=>sql.includes("pg_advisory"))).toEqual([])
      expect((await first.read(owner,deck.id)).deck.slides[0]?.notes).toBe("worker_cycles")
    } finally {releaseSave();await saving;observed.mockRestore()}
  })
},30_000)

it("runs a schema version once when two web services start together",async()=>{
  await databaseTest(async(driver,sql,stores)=>{
    let migrations=0
    const original=pg.Client.prototype.query
    const observed=vi.spyOn(pg.Client.prototype,"query")
    observed.mockImplementation(function(this:pg.Client,...args:Parameters<typeof original>){
      if(typeof args[0]==="string" && args[0].startsWith("CREATE TABLE IF NOT EXISTS editing_deck"))migrations++
      return Reflect.apply(original,this,args)
    })
    const opened=await Promise.all([createHistoryStore({...driver,schema:"migrate"}),createHistoryStore({...driver,schema:"migrate"})])
    stores.push(...opened)
    expect(migrations).toBe(1)
    expect((await sql.query("SELECT version FROM schema_version WHERE name='history'")).rows).toEqual([{version:1}])
    observed.mockRestore()
  })
},30_000)

it("rejects missing or outdated schemas in worker mode without issuing DDL",async()=>{
  await databaseTest(async(driver,sql,stores)=>{
    const statements:string[]=[]
    const original=pg.Client.prototype.query
    const observed=vi.spyOn(pg.Client.prototype,"query")
    observed.mockImplementation(function(this:pg.Client,...args:Parameters<typeof original>){
      if(typeof args[0]==="string")statements.push(args[0])
      return Reflect.apply(original,this,args)
    })
    await expect(createHistoryStore({...driver,schema:"connect",wait:noWait})).rejects.toThrow("history-schema-outdated: expected version 1, found 0")
    expect(statements.filter(sql=>/^\s*(CREATE|ALTER|DROP|LOCK|TRUNCATE|REINDEX)\b/i.test(sql))).toEqual([])
    const store=await createHistoryStore(driver);stores.push(store)
    await sql.query("UPDATE schema_version SET version=0 WHERE name='history'")
    statements.length=0
    await expect(createHistoryStore({...driver,schema:"connect",wait:noWait})).rejects.toThrow("history-schema-outdated: expected version 1, found 0")
    expect(statements.filter(sql=>/^\s*(CREATE|ALTER|DROP|LOCK|TRUNCATE|REINDEX)\b/i.test(sql))).toEqual([])
    observed.mockRestore()
    const migrated=await createHistoryStore(driver);stores.push(migrated)
    expect((await sql.query("SELECT version FROM schema_version WHERE name='history'")).rows).toEqual([{version:1}])
  })
},30_000)

it.each(["40P01","40001"])("retries the complete batch for %s without duplicating receipts or events",async code=>{
  await databaseTest(async(driver,sql,stores)=>{
    const store=await createHistoryStore(driver);stores.push(store)
    const deck=fixtureDeck(2);await store.create(owner,deck)
    await sql.query("CREATE SEQUENCE conflict_attempt")
    await sql.query(`CREATE FUNCTION conflict_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.command->>'id'='retry_failure' AND nextval('conflict_attempt')<3 THEN RAISE EXCEPTION 'private database detail' USING ERRCODE='${code}'; END IF; RETURN NEW; END $$`)
    await sql.query("CREATE TRIGGER conflict_event BEFORE INSERT ON editing_event FOR EACH ROW EXECUTE FUNCTION conflict_event()")
    const commands=[patch("retry_neighbor"),patch("retry_failure")]
    const result=await store.commitBatchSnapshot(owner,deck.id,commands,{kind:"person"},0)
    expect(result.receipts).toEqual([{kind:"applied",id:"retry_neighbor",seq:1},{kind:"applied",id:"retry_failure",seq:2}])
    expect(result.snapshot.seq).toBe(2)
    expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("retry_failure")
    expect((await store.commitBatchSnapshot(owner,deck.id,commands,{kind:"person"},0)).receipts).toEqual(result.receipts)
    for(const table of ["editing_event","editing_receipt","editing_contribution"]){
      expect((await sql.query(`SELECT count(*)::integer AS count FROM ${table} WHERE deck=$1`,[deck.id])).rows).toEqual([{count:2}])
    }
    expect((await sql.query("SELECT last_value::integer AS attempts FROM conflict_attempt")).rows).toEqual([{attempts:3}])
  })
})

it.each([["40P01",4],["40001",4],["P0001",1]] as const)("bounds persistent %s failures at %i attempts and exposes a safe public code",async(code,attempts)=>{
  await databaseTest(async(driver,sql,stores)=>{
    const store=await createHistoryStore(driver);stores.push(store)
    const deck=fixtureDeck(2);await store.create(owner,deck)
    await sql.query("CREATE SEQUENCE conflict_attempt")
    await sql.query(`CREATE FUNCTION conflict_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('conflict_attempt'); RAISE EXCEPTION 'deadlock detected: private database detail' USING ERRCODE='${code}'; END $$`)
    await sql.query("CREATE TRIGGER conflict_event BEFORE INSERT ON editing_event FOR EACH ROW EXECUTE FUNCTION conflict_event()")
    const failure=await store.commitBatchSnapshot(owner,deck.id,[patch("persistent_failure")],{kind:"person"},0).catch((error:unknown)=>error)
    expect(syncErrorCode(failure)).toBe("sync-unavailable")
    expect((await sql.query("SELECT last_value::integer AS attempts FROM conflict_attempt")).rows).toEqual([{attempts}])
    expect((await store.read(owner,deck.id)).seq).toBe(0)
    expect((await sql.query("SELECT count(*)::integer AS count FROM editing_receipt")).rows).toEqual([{count:0}])
  })
})

it("orders worker startup, imported-deck creation, saves, sync refresh, export completion and usage writes",async()=>{
  await databaseTest(async(driver,_sql,stores)=>{
    const first=await createHistoryStore(driver),second=await createHistoryStore(driver);stores.push(first,second)
    const imported=await first.catalog.create(owner,"import","Imported deck","",fixtureDeck(2),{bytes:Buffer.from("original"),report:{}})
    const job=await first.exports.submit(owner,"export",imported.id,{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false})
    const claimed=await second.exports.claim();if(!claimed)throw new Error("claim-required")
    await Promise.all([
      ...Array.from({length:8},(_,index)=>(index%2 ? first : second).commitBatchSnapshot(owner,imported.id,[patch(`concurrent_${index}`)],{kind:"person"},null)),
      first.delta(owner,imported.id,0),second.read(owner,imported.id),
      second.catalog.create(owner,"import-completion","Another import","",fixtureDeck(2)),
      first.catalog.rename(owner,imported.id,"Imported title"),
      first.exports.complete(job.id,claimed.lease,Buffer.from("export"),{}),second.exports.claim(),
      first.usage.reserve(owner.personId,{id:"usage",actor:"user-agent",request:"usage",units:1}),
      createHistoryStore(driver).then(store=>{stores.push(store)}),
      createHistoryStore(driver).then(store=>{stores.push(store)}),
    ])
    expect((await first.read(owner,imported.id)).seq).toBe(8)
    expect((await second.exports.status(owner,job.id)).kind).toBe("ready")
    expect((await first.catalog.details(owner,imported.id)).title).toBe("Imported title")
  })
},30_000)

it("returns typed failures over HTTP and WebSocket, then saves the same command after recovery",async()=>{
  await databaseTest(async(driver,sql,stores)=>{
    const store=await createHistoryStore(driver);stores.push(store)
    const deck=fixtureDeck(2);await store.create(owner,deck)
    await sql.query("CREATE SEQUENCE conflict_attempt")
    await sql.query("CREATE FUNCTION conflict_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('conflict_attempt'); RAISE EXCEPTION 'deadlock detected: private database detail' USING ERRCODE='40P01'; END $$")
    await sql.query("CREATE TRIGGER conflict_event BEFORE INSERT ON editing_event FOR EACH ROW EXECUTE FUNCTION conflict_event()")
    const access:Access={principal:async()=>owner,handle:async()=>new Response(null,{status:404}),resumeDeletions:async()=>{},close:async()=>{}}
    const server=createServer()
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve))
    const address=server.address();if(!address || typeof address==="string")throw new Error("missing-test-address")
    const origin=`http://127.0.0.1:${address.port}`,sync=attachSync(server,access,store,origin)
    const command=patch("retained_id")
    const socket=new WebSocket(`${origin.replace("http","ws")}/ws?deck=${deck.id}`,{origin})
    try{
      await once(socket,"message")
      const response=await commandsHandler(access,store,origin)(new Request(`${origin}/api/decks/${deck.id}/commands`,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(command)}))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({code:"sync-unavailable"})
      if(socket.readyState!==WebSocket.OPEN)await once(socket,"open")
      const failed=once(socket,"message")
      socket.send(JSON.stringify(command))
      const [raw]=await failed
      expect(JSON.parse(String(raw))).toEqual({kind:"error",code:"sync-unavailable"})
      expect((await sql.query("SELECT last_value::integer AS attempts FROM conflict_attempt")).rows).toEqual([{attempts:8}])
      expect((await store.read(owner,deck.id)).seq).toBe(0)
      await sql.query("DROP TRIGGER conflict_event ON editing_event")
      const saved=once(socket,"message")
      socket.send(JSON.stringify(command))
      const [receipt]=await saved
      expect(JSON.parse(String(receipt))).toMatchObject({kind:"receipt",receipt:{id:command.id,kind:"applied",seq:1}})
      expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("retained_id")
    }finally{socket.terminate();sync.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
  })
},30_000)
