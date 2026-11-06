import {expect,it} from "vitest"
import {createHash} from "node:crypto"
import {mkdir,writeFile,access} from "node:fs/promises"
import path from "node:path"
import pg from "pg"
import {mcpFixture} from "../mcp/fixture.ts"
import {deferred} from "../agent/stream.ts"
import {localAdapter} from "../../../../packages/agent/src/local-adapter.ts"
import type {AgentAdapter} from "../../../../packages/agent/src/harness.ts"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {commandId} from "../../../../packages/change-log/src/index.ts"
import {OperationStore} from "../../../../packages/operations/src/index.ts"
import {TemplateStore} from "../../../../packages/brand/src/template-store.ts"
import {deliverAccountDeletion} from "../../../worker/src/account-deletion/deliver.ts"
it("requires consent, stops an active run, removes owned rows, ends all sessions and retains only hashed receipts and the original free week",async()=>{
  const entered=deferred()
  const adapter:AgentAdapter=async function*(context,call,signal){for await(const event of localAdapter(context,call,signal)){yield event;if(event.kind==="tool"&&event.name==="apply_changes"){entered.resolve();await new Promise<void>(resolve=>signal.addEventListener("abort",()=>resolve(),{once:true}))}}}
  const fixture=await mcpFixture({agentAdapter:adapter}),db=new pg.Client({connectionString:fixture.url});await db.connect()
  try{
    const owner=await fixture.signIn("delete-owner@example.com");fixture.advance(61000)
    const tab=await fixture.signIn("delete-owner@example.com"),other=await fixture.signIn("delete-other@example.com")
    const original=await (await fixture.json("/api/account",undefined,owner.cookie)).json()
    await fixture.json("/api/decks",fixtureDeck(2,2),owner.cookie)
    const connection=await fixture.authorize(owner.cookie)
    const payment=await fixture.history.usage.checkout(owner.personId,1000);await fixture.history.usage.receivePayment({id:"delete-paid",payment:payment.id,cents:1000,kind:"paid"})
    expect((await fixture.json("/api/account/deletion",{confirm:"no"},owner.cookie)).status).toBe(400)
    expect((await fixture.json("/api/account",undefined,owner.cookie)).status).toBe(200)
    await fixture.json("/api/aira?deck=deck",{action:"send",text:"Delete while active"},owner.cookie);await entered.promise
    const deleted=await fixture.json("/api/account/deletion",{confirm:"delete-account"},owner.cookie);expect(deleted.status).toBe(200);expect(await deleted.json()).toEqual({status:"deleted"})
    expect(await (await fixture.json("/api/account",undefined,tab.cookie)).json()).toMatchObject({status:"signed-out"})
    expect(await (await fixture.json("/api/account",undefined,other.cookie)).json()).toMatchObject({status:"signed-in"})
    expect((await fixture.json("/api/aira?deck=deck",undefined,owner.cookie)).status).toBe(401)
    await expect(fixture.history.create({personId:owner.personId},fixtureDeck(1,1))).rejects.toThrow("account-deleted")
    await expect(fixture.history.usage.status(owner.personId)).rejects.toThrow("account-deleted")
    for(const table of ["editing_deck","aira_run","aira_preference","catalog_request","owned_file","tool_snapshot","image_asset","image_owner","template_source","usage_payment","usage_event","usage_reservation","usage_account"]){expect((await db.query(`SELECT count(*)::int AS count FROM ${table} WHERE owner=$1`,[owner.personId])).rows[0].count,table).toBe(0)}
    expect((await db.query("SELECT count(*)::int AS count FROM usage_payment_receipt")).rows[0].count).toBe(0)
    expect((await db.query("SELECT count(*)::int AS count FROM oauth_connection WHERE data->>'owner'=$1",[owner.personId])).rows[0].count).toBe(0)
    expect((await db.query('SELECT count(*)::int AS count FROM airdesign.session WHERE "userId"=$1',[owner.personId])).rows[0].count).toBe(0)
    const tombstone=(await db.query(`SELECT *,to_char("freeUsageWeekStartedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week FROM airdesign.tombstone WHERE "emailHash"=$1`,[createHash("sha256").update("delete-owner@example.com").digest("hex")])).rows[0]
    expect(tombstone.week).toBe(original.freeUsageWeekStartedAt)
    expect(await fixture.history.deletions.purge(owner.personId)).toBe(false)
    await fixture.history.deletions.enqueue(owner.personId)
    expect(await fixture.history.deletions.pending()).toEqual([])
    fixture.advance(86400000)
    const again=await fixture.signIn("delete-owner@example.com")
    expect(again.personId).not.toBe(owner.personId)
    expect(await (await fixture.json("/api/account",undefined,again.cookie)).json()).toMatchObject({freeUsageWeekStartedAt:original.freeUsageWeekStartedAt})
    expect(connection.tokens.access_token).toBeTruthy()
  }finally{await db.end();await fixture.close()}
})
it("durably queues deletion while a worker owns a lease, then removes queued bytes and prevents late writes",async()=>{
  const fixture=await mcpFixture(),operations=new OperationStore(fixture.operationsPath,fixture.now),images=new OperationStore(fixture.operationsPath+".images",fixture.now),templates=new TemplateStore(path.join(fixture.directory,"templates.sqlite")),root=path.join(fixture.directory,"jobs")
  try{
    const owner=await fixture.signIn("delete-worker@example.com"),directory=path.join(root,createHash("sha256").update(owner.personId).digest("hex"))
    await fixture.json("/api/decks",fixtureDeck(1,1),owner.cookie);await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"source.pptx"),"owned input")
    const operation=operations.submit({personId:owner.personId},"deleting",Buffer.from("source")),lease=operations.claim(operation.id);if(!lease)throw new Error("lease-missing")
    expect((await fixture.json("/api/account/deletion",{confirm:"delete-account"},owner.cookie)).status).toBe(200)
    expect(await fixture.history.deletions.pending()).toHaveLength(1)
    await expect(fixture.history.commit({personId:owner.personId},"deck",{id:commandId("late"),kind:"patch",target:fixtureDeck(1,1).id,fields:{version:1},base:0,run:null})).rejects.toThrow("account-deleting")
    await expect(fixture.history.usage.status(owner.personId)).rejects.toThrow("account-deleting")
    operations.fail(operation.id,lease.lease,"account-deleted")
    expect(await deliverAccountDeletion(fixture.history,operations,images,templates,root)).toHaveLength(1)
    expect(await deliverAccountDeletion(fixture.history,operations,images,templates,root)).toEqual([])
    await expect(access(directory)).rejects.toThrow()
    expect(await fixture.history.deletions.pending()).toEqual([])
  }finally{operations.close();images.close();templates.close();await fixture.close()}
})

it("retries auth cleanup after owned purge has completed",async()=>{
  const fixture=await mcpFixture(),db=new pg.Client({connectionString:fixture.url});await db.connect()
  try{
    const owner=await fixture.signIn("retry-auth@example.com");await fixture.json("/api/decks",fixtureDeck(1,1),owner.cookie)
    await db.query("CREATE FUNCTION airdesign.fail_auth_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'interrupted-auth-cleanup'; END $$")
    await db.query('CREATE TRIGGER interrupt_cleanup BEFORE DELETE ON airdesign."user" FOR EACH STATEMENT EXECUTE FUNCTION airdesign.fail_auth_cleanup()')
    expect((await fixture.json("/api/account/deletion",{confirm:"delete-account"},owner.cookie)).status).toBe(500)
    expect((await fixture.json("/api/account",undefined,owner.cookie)).status).toBe(401)
    expect((await db.query("SELECT owner FROM airdesign.account_deletion_job")).rows).toHaveLength(1)
    await db.query('DROP TRIGGER interrupt_cleanup ON airdesign."user"')
    expect((await fixture.json("/api/account/deletion",{confirm:"delete-account"},owner.cookie)).status).toBe(401)
    expect((await db.query("SELECT owner FROM airdesign.account_deletion_job")).rows).toEqual([])
    expect((await db.query('SELECT id FROM airdesign."user"')).rows).toEqual([])
    expect(await fixture.history.deletions.pending()).toEqual([])
  }finally{await db.end();await fixture.close()}
})

it("reconciles web-owned queued bytes after a remote worker releases a deleting account",async()=>{
  const fixture=await mcpFixture(),operations=new OperationStore(fixture.operationsPath,fixture.now)
  try{
    const owner=await fixture.signIn("delete-remote-worker@example.com")
    const operation=operations.submit({personId:owner.personId},"remote-delete",Buffer.from("source")),lease=operations.claim(operation.id)
    if(!lease)throw new Error("lease-missing")
    await fixture.json("/api/account/deletion",{confirm:"delete-account"},owner.cookie)
    expect(await fixture.history.deletions.pending()).toHaveLength(1)
    operations.fail(operation.id,lease.lease,"account-deleted")
    const response=await fetch(fixture.origin+"/internal/worker",{method:"POST",headers:{authorization:"Bearer dev-only-secret-change-me-32chars","content-type":"application/json"},body:JSON.stringify({kind:"claim",queue:"import"})})
    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
    expect(await fixture.history.deletions.pending()).toEqual([])
    expect(()=>operations.status({personId:owner.personId},operation.id)).toThrow("not-found")
  }finally{operations.close();await fixture.close()}
})
