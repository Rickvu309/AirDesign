import {expect,it} from "vitest"
import {DatabaseSync} from "node:sqlite"
import {execFileSync,spawn} from "node:child_process"
import {once} from "node:events"
import {mkdtemp,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import pg from "pg"
import {OperationStore} from "../../../../packages/operations/src/index.ts"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {reconcileImports,workerHandler} from "../../src/worker/handle.ts"
import {mcpFixture} from "./fixture.ts"

it("recovers a killed catalog-to-ready transition using the original request and preserves reads across restart",async()=>{
  const fixture=await mcpFixture(),owner=await fixture.signIn("completion@example.com")
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/import-recovery-")),database=path.join(directory,"operations.sqlite")
  let store=new OperationStore(database),images=new OperationStore(":memory:")
  const report={deck:fixtureDeck(1)},bytes=Buffer.from("imported-presentation")
  const sql=new pg.Client({connectionString:fixture.url});await sql.connect()
  try{
    const job=store.submit(owner,"original-write",Buffer.from("input"),true),claim=store.claim(job.id)
    if(!claim)throw new Error("missing-lease")
    const moduleRoot=process.cwd()
    const source=`import {OperationStore} from ${JSON.stringify(path.join(moduleRoot,"packages/operations/src/index.ts"))};import {createHistoryStore} from ${JSON.stringify(path.join(moduleRoot,"apps/server/src/db/history-store.ts"))};const store=new OperationStore(${JSON.stringify(database)});const history=await createHistoryStore({kind:'postgres',url:${JSON.stringify(fixture.url)},schema:'connect'});if(!store.stage(${JSON.stringify(job.id)},${JSON.stringify(claim.lease)},Buffer.from(${JSON.stringify(bytes.toString("base64"))},'base64'),${JSON.stringify(report)}))throw Error('stage-failed');await history.catalog.create(${JSON.stringify(owner)},'original-write','Imported deck','',${JSON.stringify(report.deck)},{bytes:Buffer.from(${JSON.stringify(bytes.toString("base64"))},'base64'),report:${JSON.stringify(report)}},${JSON.stringify(`mcp_import_${job.id}`)});process.stdout.write('catalog-committed');process.stdin.resume();`
    const child=spawn(process.execPath,["--input-type=module","-e",source],{stdio:["pipe","pipe","inherit"]})
    await once(child.stdout,"data",{signal:AbortSignal.timeout(30000)})
    const exited=once(child,"exit");child.kill("SIGKILL");expect((await exited)[1]).toBe("SIGKILL")
    expect(store.status(owner,job.id).kind).toBe("running")
    expect(store.cancel(owner,job.id).kind).toBe("running")
    expect(store.recover()).toEqual([])
    expect(store.submit(owner,"original-write",Buffer.from("input"),true).id).toBe(job.id)
    expect(()=>store.submit(owner,"original-write",Buffer.from("changed"),true)).toThrow("request-id-payload-conflict")
    store.close();store=new OperationStore(database)
    await Promise.all([reconcileImports(store,fixture.history),reconcileImports(store,fixture.history)])
    expect(store.status(owner,job.id)).toMatchObject({kind:"ready",report})
    expect(store.artifact(owner,job.id)).toEqual(bytes)
    const entry=await fixture.history.catalog.request(owner,"original-write");expect(entry).toBeTruthy()
    expect(await fixture.history.catalog.request(owner,`mcp_import_${job.id}`)).toEqual(entry)
    expect(await fixture.history.catalog.list(owner)).toHaveLength(1)
    const handler=workerHandler(store,images,"secret",async()=>[],path.join(directory,"artifacts"),fixture.history)
    const complete=()=>handler(new Request("https://test/internal/worker",{method:"POST",headers:{authorization:"Bearer secret"},body:JSON.stringify({kind:"complete",queue:"import",id:job.id,lease:claim.lease,report})}))
    expect((await Promise.all([complete(),complete()])).map(response=>response.status)).toEqual([200,200])
    const snapshot=async()=>({operations:new DatabaseSync(database,{readOnly:true}),history:(await sql.query("SELECT row_to_json(d) AS row FROM editing_deck d ORDER BY id")).rows,requests:(await sql.query("SELECT row_to_json(r) AS row FROM catalog_request r ORDER BY request")).rows})
    const before=await snapshot(),operationRows=before.operations.prepare("SELECT * FROM operations").all(),intents=before.operations.prepare("SELECT * FROM import_finalization").all();before.operations.close()
    store.close();store=new OperationStore(database)
    await reconcileImports(store,fixture.history)
    for(const result of await Promise.all([Promise.resolve(store.status(owner,job.id)),Promise.resolve(store.status(owner,job.id))]))expect(result.kind).toBe("ready")
    const after=await snapshot()
    expect(after.history).toEqual(before.history);expect(after.requests).toEqual(before.requests)
    expect(after.operations.prepare("SELECT * FROM operations").all()).toEqual(operationRows)
    expect(after.operations.prepare("SELECT * FROM import_finalization").all()).toEqual(intents);after.operations.close()
    expect(()=>store.status({personId:"stranger"},job.id)).toThrow("operation-not-found")
    await expect(fixture.history.catalog.create(owner,"original-write","Changed")).rejects.toThrow("request-id-payload-conflict")
  }finally{store.close();images.close();await sql.end();await fixture.close();await rm(directory,{recursive:true,force:true})}
},60000)

it("adopts ready legacy jobs and existing legacy catalog requests without changing reports or duplicating decks",async()=>{
  const fixture=await mcpFixture(),owner=await fixture.signIn("legacy@example.com"),store=new OperationStore(":memory:")
  try{
    for(const existing of [false,true]){
      const job=store.submit(owner,`legacy-${existing}`,Buffer.from(String(existing))),claim=store.claim(job.id)
      if(!claim)throw new Error("missing-lease")
      const report={deck:fixtureDeck(1)},bytes=Buffer.from("legacy-result")
      expect(store.complete(job.id,claim.lease,bytes,report)).toBe(true)
      const old=existing ? await fixture.history.catalog.create(owner,`mcp_import_${job.id}`,"Imported deck","",report.deck,{bytes,report}) : null
      if(!existing)store.submit(owner,`legacy-${existing}`,Buffer.from(String(existing)),true)
      const before=store.status(owner,job.id)
      await reconcileImports(store,fixture.history)
      expect(store.status(owner,job.id)).toEqual(before)
      const entry=await fixture.history.catalog.request(owner,`legacy-${existing}`)
      if(old)expect(entry).toEqual(old)
      expect(await fixture.history.catalog.create(owner,`mcp_import_${job.id}`,"Imported deck","",report.deck,{bytes,report})).toEqual(entry)
    }
    const studio=store.submit(owner,"studio",Buffer.from("studio")),lease=store.claim(studio.id)
    if(!lease)throw new Error("missing-lease")
    store.complete(studio.id,lease.lease,Buffer.from("studio-result"),{deck:fixtureDeck(1)})
    await reconcileImports(store,fixture.history)
    expect(await fixture.history.catalog.request(owner,"studio")).toBeNull()
    expect(await fixture.history.catalog.list(owner)).toHaveLength(2)
  }finally{store.close();await fixture.close()}
},60000)

it("fences cancelled and expired leases before any durable intent and makes expiry polling read only",()=>{
  let now=0
  const store=new OperationStore(":memory:",()=>now),owner={personId:"owner"}
  try{
    for(const cancelled of [false,true]){
      now=0
      const job=store.submit(owner,`fence-${cancelled}`,Buffer.from("input"),true),claim=store.claim(job.id)
      if(!claim)throw new Error("missing-lease")
      if(cancelled)store.cancel(owner,job.id);else now=35001
      expect(store.stage(job.id,claim.lease,Buffer.from("output"),{deck:fixtureDeck(1)})).toBe(false)
      expect(store.finalizations()).toEqual([])
    }
  }finally{store.close()}
})

it("rolls back an interrupted SQLite migration and runs the previous store against the additive schema",async()=>{
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/import-migration-")),database=path.join(directory,"operations.sqlite")
  const oldUrl=new URL("./fixtures/legacy-operation-store.ts",import.meta.url).href
  try{
    execFileSync(process.execPath,["--input-type=module","-e",`import {OperationStore} from ${JSON.stringify(oldUrl)};const store=new OperationStore(${JSON.stringify(database)});store.submit({personId:'owner'},'old',Buffer.from('input'));store.close()`])
    const source=`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(${JSON.stringify(database)});db.exec('BEGIN IMMEDIATE;CREATE TABLE import_finalization(id TEXT PRIMARY KEY,lease TEXT,result BLOB,report TEXT)');process.stdout.write('ddl-uncommitted');process.stdin.resume()`
    const child=spawn(process.execPath,["--input-type=module","-e",source],{stdio:["pipe","pipe","inherit"]})
    await once(child.stdout,"data",{signal:AbortSignal.timeout(10000)});const exited=once(child,"exit");child.kill("SIGKILL");await exited
    const started=performance.now(),store=new OperationStore(database),elapsed=performance.now()-started
    process.stdout.write(`SQLite constructor wall time including BEGIN IMMEDIATE to COMMIT upper bound: ${elapsed.toFixed(3)}ms\n`)
    expect(elapsed).toBeLessThan(5000);store.close()
    execFileSync(process.execPath,["--input-type=module","-e",`import {OperationStore} from ${JSON.stringify(oldUrl)};const store=new OperationStore(${JSON.stringify(database)});const job=store.submit({personId:'owner'},'old',Buffer.from('input'));const claim=store.claim(job.id);if(!claim||!store.complete(job.id,claim.lease,Buffer.from('result'),{compatible:true}))throw Error('old-completion-failed');if(store.status({personId:'owner'},job.id).kind!=='ready')throw Error('old-status-failed');store.close()`])
    const reopened=new OperationStore(database)
    expect(reopened.submit({personId:"owner"},"old",Buffer.from("input"))).toMatchObject({kind:"ready",report:{compatible:true}});reopened.close()
  }finally{await rm(directory,{recursive:true,force:true})}
},30000)
