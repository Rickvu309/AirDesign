import assert from "node:assert/strict"
import pg from "pg"
import path from "node:path"
import {scenario,save,head,execute,evidence,toolValue} from "./fixture.mjs"
const s=await scenario(),db=new pg.Client(s.fixture.url)
await db.connect()
let serial=0
const usage=owner=>s.request(owner,"/api/usage")
const read=(owner,id)=>s.request(owner,`/api/decks/${id}`)
const command=(owner,id,input)=>s.request(owner,`/api/decks/${id}/commands`,{id:`probe_${++serial}`,...input})
const checkout=async(owner,cents=1000)=>(await s.request(owner,"/api/billing/checkout",{cents})).payment
const settle=(payment,id,kind="paid")=>s.webhook({id,payment:payment.id,cents:payment.cents,kind})
async function fill(owner,id){const state=await usage(owner);if(state.remaining)await s.fixture.history.usage.reserve(owner.personId,{id,actor:"user-agent",request:"Recorded fixture workload",units:state.remaining});return s.fixture.history.usage.reserve(owner.personId,{id:id+"_blocked",actor:"user-agent",request:"Saved limit request",units:1})}
async function lane(n,work){const start=s.trace.length,owner=await s.fixture.signIn(`p08-lane-${n}@example.com`),id=`lane${n}`;await s.deck(owner,id,n===1 ? 0 : 2);try{const facts=await work(owner,id);await save(`lane-${n}/receipt.json`,{head,verdict:"pass",fixture:"deterministic SDK tools, signed local payment provider, isolated PostgreSQL",facts});await save(`lane-${n}/trace.json`,s.trace.slice(start));await save(`lane-${n}/terminal.txt`,JSON.stringify({head,lane:n,verdict:"pass",facts},null,2));process.stdout.write(`lane-${n}: pass\n`)}catch(error){await save(`lane-${n}/receipt.json`,{head,verdict:"fail",error:String(error)});await save(`lane-${n}/trace.json`,s.trace.slice(start));throw error}}
try{
  await lane(1,async(owner,id)=>{
    const baseline=(await execute("git",["ls-tree","-r","--name-only","fc1e66a9065b0df8c173cd96ebc48930f250913c","packages/agent","apps/server/src/agent","apps/server/src/billing"])).stdout
    assert.equal(baseline,"")
    await save("perf/baseline.json",{head,trunk:"fc1e66a9065b0df8c173cd96ebc48930f250913c",paths:["packages/agent","apps/server/src/agent","apps/server/src/billing"],tree:baseline,verdict:"feature absent",relativeRule:"N/A: no comparable Aira or checkout surface"})
    const run=await s.run(owner,id,"A decision-ready executive overview"),saved=await read(owner,id);assert.equal(run.kind,"complete");assert.equal(saved.deck.slides.length,1);assert.equal(saved.deck.slides[0].elements[0].runs[0].text,"A decision-ready executive overview")
    const payment=await checkout(owner);await settle(payment,"lane1-paid");const blocked=await fill(owner,"lane1-fill"),reset=await s.request(owner,"/api/usage/reset",{limitHit:blocked.limitHit});assert.equal(reset.paid,500);assert.equal(reset.used,0)
    const facts={baseline:"absent",newRun:run.id,editableTitle:saved.deck.slides[0].elements[0].id,payment,reset,provider:"local signed fixture; real sandbox unavailable X06"};await save("lane-1/comparison.json",{head,baseline:{head:"fc1e66a9065b0df8c173cd96ebc48930f250913c",paths:baseline,verdict:"feature absent"},result:facts});return facts
  })
  await lane(2,async(owner,id)=>{
    const before=await read(owner,id),run=await s.run(owner,id,"Selected content only",["s0e0"]),after=await read(owner,id);assert.equal(after.deck.slides[0].elements[0].runs[0].text,"Selected content only");assert.deepEqual(after.deck.slides[1],before.deck.slides[1]);assert.deepEqual(run.events.filter(event=>event.name==="apply_changes").map(event=>event.scope),["s0"])
    const payment=await checkout(owner);await Promise.all([settle(payment,"lane2-paid"),settle(payment,"lane2-paid")]);assert.equal((await usage(owner)).paid,1000)
    await s.fixture.history.usage.grantFixture(owner.personId,"lane2-bonus",300,"bonus");const blocked=await fill(owner,"lane2-fill");await s.request(owner,"/api/usage/reset",{limitHit:blocked.limitHit});await s.fixture.history.usage.grantFixture(owner.personId,"lane2-bonus-after",300,"bonus")
    await settle(payment,"lane2-refund","refunded");const refunded=await usage(owner);assert.equal(refunded.paid,0);assert.equal(refunded.bonus,300)
    const second=await checkout(owner);await settle(second,"lane2-second");await settle(second,"lane2-chargeback","chargeback");assert.equal((await usage(owner)).paid,0)
    const audit=(await db.query("SELECT data FROM usage_payment_receipt WHERE payment=ANY($1)",[[payment.id,second.id]])).rows;assert.equal(audit.length,4)
    await assert.rejects(db.query("UPDATE usage_payment_receipt SET data='{}' WHERE payment=$1",[payment.id]),/append-only/)
    return {scope:run.selection,changedScopes:["s0"],used:(await usage(owner)).used,refund:refunded,receiptCount:audit.length,immutable:true}
  })
  await lane(3,async(owner,id)=>{
    const run=await s.run(owner,id,"Refine the whole deck"),saved=await read(owner,id);assert.ok(saved.deck.slides.every(slide=>slide.notes==="Refine the whole deck"));assert.equal(run.events.filter(event=>event.name==="apply_changes").length,2)
    const payment=await checkout(owner),forged=await s.webhook({id:"lane3-forged",payment:payment.id,cents:1000,kind:"paid"},true);assert.equal(forged.code,"invalid-signature");assert.equal((await usage(owner)).paid,0);return {run:run.id,intended:saved.deck.slides.map(slide=>slide.id),used:(await usage(owner)).used,forged}
  })
  await lane(4,async(owner,id)=>{
    const remote=await s.fixture.authorize(owner.cookie,"Lane four reference"),old=await command(owner,id,{kind:"start-run",run:"older_lane4"}),source=await s.stream(owner,id),hold=s.hold()
    const started=await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Initial whole-deck request"},202);await hold.entered.promise
    const saved=await read(owner,id),humanStart=performance.now(),human=await command(owner,id,{kind:"patch",base:saved.seq,run:null,target:"s0e0",fields:{runs:[{text:"My edit while Aira works",bold:true,font:"Geist",size:40,color:"#172333"}]}}),humanMs=performance.now()-humanStart;assert.equal(human.kind,"applied")
    s.fixture.advance(61000);const tab=await s.fixture.signIn("p08-lane-4@example.com"),steer=await s.request(tab,`/api/aira?deck=${id}`,{action:"send",text:"Steer the remaining slide"},200);assert.equal(steer.id,started.id);assert.equal(steer.joined,true)
    const staleResponse=await fetch(s.fixture.apiOrigin+`/api/decks/${id}/commands`,{method:"POST",headers:{origin:s.origin,cookie:owner.cookie,"content-type":"application/json","x-run-credential":old.runCredential},body:JSON.stringify({id:"lane4_old_write",kind:"patch",base:(await read(owner,id)).seq,run:"older_lane4",target:"s0e0",fields:{runs:[{text:"Older run overwrite",bold:true,font:"Geist",size:40,color:"#172333"}]}})}),stale=await staleResponse.json();s.trace.push({operation:"older authenticated run write",status:staleResponse.status,value:stale});assert.equal(stale.kind,"refused")
    hold.release.resolve();await s.until(source,value=>value.run?.kind==="complete")
    const current=await read(owner,id),write=await remote.client.callTool({name:"apply_changes",arguments:{deckId:id,base:current.seq,requestId:"lane4_remote",changes:[{kind:"set",target:"s0e1",value:{...current.deck.slides[0].elements[1],fill:"#334455"}}]}});assert.notEqual(write.isError,true)
    const activity=await s.until(source,value=>value.remote.some(event=>event.targets.includes("s0e1")))
    const payment=await checkout(owner),returned=await s.request(tab,`/api/billing/payments/${payment.id}`);assert.equal(returned.kind,"pending");assert.equal((await usage(owner)).paid,0);await settle(payment,"lane4-paid");assert.equal((await s.request(tab,`/api/billing/payments/${payment.id}`)).kind,"paid")
    return {run:started.id,secondSessionSameOwner:tab.personId===owner.personId,steer,humanMs,stale,remote:activity.remote,pendingReturn:returned,paid:(await usage(owner)).paid}
  })
  await lane(5,async(owner,id)=>{
    const source=await s.stream(owner,id),hold=s.hold();await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Keep the accepted first change"},202);await hold.entered.promise;const stopped=await s.request(owner,`/api/aira?deck=${id}`,{action:"stop"});assert.equal(stopped.kind,"stopped");hold.release.resolve();await s.until(source,value=>value.run?.kind==="stopped");const saved=await read(owner,id);assert.equal(saved.deck.slides[0].notes,"Keep the accepted first change");assert.equal(saved.deck.slides[1].notes,"Canonical render fixture");assert.equal((await usage(owner)).used,3)
    const payment=await checkout(owner);s.fixture.advance(31*60000);assert.equal((await s.request(owner,`/api/billing/payments/${payment.id}`)).kind,"expired");assert.equal((await usage(owner)).paid,0)
    const race=await checkout(owner);await Promise.all([s.request(owner,`/api/billing/payments/${race.id}`,{}),settle(race,"lane5-race"),settle(race,"lane5-race")]);assert.equal((await s.request(owner,`/api/billing/payments/${race.id}`)).kind,"paid");assert.equal((await usage(owner)).paid,1000)
    return {stopped,acceptedSlides:1,used:3,expired:payment.id,race:race.id,paid:1000}
  })
  await lane(6,async(owner,id)=>{
    const source=await s.stream(owner,id),hold=s.hold(true),started=await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Resume this saved request"},202);await hold.entered.promise;hold.release.resolve();const failed=(await s.until(source,value=>value.run?.kind==="failed")).run;assert.equal((await usage(owner)).used,3)
    const resumed=await s.request(owner,`/api/aira?deck=${id}`,{action:"resume"},202);assert.equal(resumed.id,started.id);const complete=(await s.until(source,value=>value.run?.kind==="complete")).run;assert.equal(complete.events.filter(event=>event.name==="apply_changes").length,2);assert.equal((await usage(owner)).used,6)
    const payment=await checkout(owner),blocked=await fill(owner,"lane6-fill");s.fixture.advance(7*86400000);await settle(payment,"lane6-late");const state=await usage(owner);assert.equal(state.used,0);assert.equal(state.paid,1000);await s.request(owner,"/api/usage/reset",{limitHit:blocked.limitHit},400);assert.equal((await usage(owner)).paid,1000)
    return {failedRun:failed.id,resumedRun:complete.id,acceptedOnce:2,paymentAfterMonday:state,staleResetRefused:true}
  })
  await lane(7,async(owner,id)=>{
    await s.fixture.history.usage.reserve(owner.personId,{id:"lane7-almost",actor:"user-agent",request:"Existing workload",units:9998})
    const run=await s.run(owner,id,"Keep this request at the usage limit"),saved=await read(owner,id);assert.equal(run.kind,"limited");assert.equal(run.events.filter(event=>event.name==="apply_changes").length,1);assert.equal(saved.deck.slides[0].notes,run.request);assert.equal(saved.deck.slides[1].notes,"Canonical render fixture");assert.equal((await usage(owner)).used,10001)
    const manual=await command(owner,id,{kind:"patch",base:saved.seq,run:null,target:"s0e0",fields:{box:{x:50,y:40,width:800,height:60}}});assert.equal(manual.kind,"applied")
    const payments=await Promise.all([checkout(owner),checkout(owner,2500),checkout(owner,3000)]);assert.equal(new Set(payments.map(payment=>payment.id)).size,1);await settle(payments[0],"lane7-paid");const fresh=await checkout(owner);assert.notEqual(fresh.id,payments[0].id)
    return {run:run.id,savedRequest:run.request,atomicChanges:1,used:10001,manual:manual.kind,pendingIds:payments.map(payment=>payment.id),nextPayment:fresh.id,paid:(await usage(owner)).paid}
  })
  await lane(8,async(owner,id)=>{
    const remote=await s.fixture.authorize(owner.cookie,"Lane eight reference"),source=await s.stream(owner,id),hold=s.hold();await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Disable active Aira"},202);await hold.entered.promise;await s.request(owner,"/api/aira/configure",{enabled:false});hold.release.resolve();await s.until(source,value=>value.run?.kind==="stopped");await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Off"},400)
    let current=await read(owner,id);assert.equal((await command(owner,id,{kind:"patch",base:current.seq,run:null,target:"s0e0",fields:{box:{x:60,y:40,width:800,height:60}}})).kind,"applied");current=await read(owner,id)
    const write=await remote.client.callTool({name:"apply_changes",arguments:{deckId:id,base:current.seq,requestId:"lane8_remote",changes:[{kind:"set",target:"s1",value:{...current.deck.slides[1],notes:"Remote remains authorized"}}]}});assert.notEqual(write.isError,true)
    const payment=await checkout(owner);await settle(payment,"lane8-paid");await s.fixture.history.usage.grantFixture(owner.personId,"lane8-bonus",400,"bonus");const blocked=await fill(owner,"lane8-fill"),reset=await s.request(owner,"/api/usage/reset",{limitHit:blocked.limitHit});assert.equal(reset.bonus,0);assert.equal(reset.paid,900)
    const model=(await db.query("SELECT id,data FROM usage_reservation WHERE owner=$1",[owner.personId])).rows.map(row=>({reservation:row.id,units:row.data.units,actor:row.data.actor})),input={owner:owner.personId,id:"lane8-reconcile",payments:[s.provider.sign({id:"lane8-paid",payment:payment.id,cents:1000,kind:"paid"})],model},file=path.join(evidence,"lane-8","fixture.json");await save("lane-8/fixture.json",input)
    const cli=async filename=>execute("node",["apps/server/src/billing/reconcile.ts",filename],{env:{...process.env,AIRDESIGN_DATABASE_URL:s.fixture.url},maxBuffer:100000})
    const first=JSON.parse((await cli(file)).stdout),second=JSON.parse((await cli(file)).stdout);assert.deepEqual(first,second);assert.equal(first.missing.length+first.mismatched.length,0)
    await save("lane-8/discrepancy.json",{...input,id:"lane8-mismatch",model:[{...model[0],units:model[0].units+1}]});let mismatch;try{await cli(path.join(evidence,"lane-8/discrepancy.json"));assert.fail("mismatch accepted")}catch(error){assert.equal(error.code,1);mismatch=JSON.parse(error.stdout)}assert.equal(mismatch.mismatched.length,1);assert.equal((await usage(owner)).paid,900)
    return {disabled:true,manual:"applied",remote:toolValue(write),reset,reconciliation:first,replayed:second,discrepancy:mismatch,balanceUnchanged:true}
  })
  await lane(9,async(owner,id)=>{
    const run=await s.run(owner,id,"Run contribution",["s0e0","s1e0"]),current=await read(owner,id);await command(owner,id,{kind:"patch",base:current.seq,run:null,target:"s0e0",fields:{runs:[{text:"Keep my later words",bold:true,font:"Geist",size:40,color:"#172333"}]}});const undo=await s.request(owner,`/api/aira?deck=${id}`,{action:"undo"});assert.deepEqual(undo.kept,["s0e0"]);const saved=await read(owner,id);assert.equal(saved.deck.slides[0].elements[0].runs[0].text,"Keep my later words");assert.equal(saved.deck.slides[1].elements[0].runs[0].text,"A clear direction")
    const first=await s.fixture.authorize(owner.cookie,"Revoke only this agent"),second=await s.fixture.authorize(owner.cookie,"Keep this agent"),connections=await s.request(owner,"/api/agents"),target=connections.find(value=>value.name==="Revoke only this agent");await s.request(owner,`/api/agents/${target.id}/revoke`,{})
    const revoked=await fetch(s.fixture.apiOrigin+"/mcp",{method:"POST",headers:{authorization:`Bearer ${first.tokens.access_token}`,"content-type":"application/json",accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list",params:{}})});assert.equal(revoked.status,401);assert.notEqual((await second.client.callTool({name:"get_deck",arguments:{deckId:id}})).isError,true);assert.equal((await s.request(owner,"/api/account")).status,"signed-in")
    return {run:run.id,undo,keptWords:"Keep my later words",revokedConnection:target.id,revokedHTTP:401,otherAgentAvailable:true,sessionAvailable:true}
  })
  await lane(10,async(owner,id)=>{
    const source=await s.stream(owner,id),hold=s.hold(),start=await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text:"Delete during an active run"},202);await hold.entered.promise;const snapshot=await s.request(owner,`/api/aira?deck=${id}`),reconnected=await s.stream(owner,id);await s.request(owner,`/api/aira?deck=${id}`);assert.equal((await usage(owner)).used,3)
    const payment=await checkout(owner);await settle(payment,"lane10-paid");const refused=await s.request(owner,"/api/account/deletion",{confirm:"no"},400);assert.equal((await s.request(owner,"/api/account")).status,"signed-in")
    const original=await s.request(owner,"/api/account");s.fixture.advance(61000);const tab=await s.fixture.signIn("p08-lane-10@example.com"),other=await s.fixture.signIn("p08-delete-other@example.com")
    const deleted=await s.request(owner,"/api/account/deletion",{confirm:"delete-account"});hold.release.resolve();assert.equal(deleted.status,"deleted");assert.equal((await s.request(tab,"/api/account",undefined,401)).status,"signed-out");assert.equal((await s.request(other,"/api/account")).status,"signed-in")
    const tables=["editing_deck","aira_run","usage_account","usage_event","usage_reservation","usage_payment","owned_file","tool_snapshot","image_asset","image_owner","template_source"],counts={};for(const table of tables){counts[table]=(await db.query(`SELECT count(*)::int AS count FROM ${table} WHERE owner=$1`,[owner.personId])).rows[0].count;assert.equal(counts[table],0)}
    const tombstones=(await db.query('SELECT "emailHash",to_char("freeUsageWeekStartedAt",\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') AS week FROM airdesign.tombstone')).rows;assert.ok(tombstones.some(value=>value.week===original.freeUsageWeekStartedAt));assert.equal(await s.fixture.history.deletions.purge(owner.personId),false)
    return {run:start.id,snapshotEventIds:snapshot.run.events.map(value=>value.id),reconnectNoAdditionalDebit:true,explicitConfirmationRefusal:refused,deleted,allTabsEnded:true,ownedRows:counts,tombstoneRetainsOriginalWeek:true,retention:"local purge completed immediately; <=30 days",accessibilityEvidence:"review/receipt.json; actual AT transcripts pending P09 X02"}
  })
  await save("perf/baseline.json",{head:"fc1e66a9065b0df8c173cd96ebc48930f250913c",verdict:"absent",evidence:"lane-1/comparison.json",reason:"No Aira harness or payment provider surface exists at trunk; absolute C07 budgets apply."})
}finally{await db.end();await s.close()}
