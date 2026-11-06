import assert from "node:assert/strict"
import {execFileSync} from "node:child_process"
import {mkdir,writeFile,readFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {performance} from "node:perf_hooks"
import sharp from "sharp"
import {mcpFixture,toolValue} from "../../apps/server/test/mcp/fixture.ts"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {usageWeek} from "../../packages/usage/src/week.ts"
import {mcpPin} from "../../packages/tools/src/catalog.ts"
import {OperationStore,operationId} from "../../packages/operations/src/index.ts"
import {importPptx,exportPptx} from "../../packages/pptx/src/index.ts"
import {importedDeck} from "../../packages/pptx/src/import-deck.ts"
import {readImageJob} from "../../packages/files/src/assets/image-job.ts"
import {validateImage,serializeValidatedImage} from "../../packages/files/src/assets/validate.ts"

const root=process.env.P07_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-autopilot/P07")
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const baseline="8e11652fa15bcebe5a25f92452cd2a785637d4cd"
const absent=execFileSync("git",["ls-tree","-r","--name-only",baseline,"packages/usage","apps/server/src/mcp","packages/access/src/oauth"],{encoding:"utf8"}).trim()===""
async function save(directory,name,value){await mkdir(directory,{recursive:true});await writeFile(path.join(directory,name),JSON.stringify(value,null,2)+"\n")}
async function finishImage(fixture,job){
  const worker=new OperationStore(fixture.operationsPath+".images",fixture.now)
  try{const claimed=worker.claim(operationId(job.id));assert.ok(claimed);const input=readImageJob(claimed.input),image=await validateImage(input.bytes);assert.equal(worker.complete(operationId(job.id),claimed.lease,serializeValidatedImage(image,input.provenance),{hash:image.hash}),true)}finally{worker.close()}
}
async function runLane(number,work){
  const fixture=await mcpFixture(),trace=[],directory=path.join(root,`lane-${number}`)
  try{
    const owner=await fixture.signIn(`lane${number}@example.com`),authorized=await fixture.authorize(owner.cookie)
    assert.equal((await fixture.json("/api/decks",fixtureDeck(4,55),owner.cookie)).status,201)
    const api=async(route,body,cookie=owner.cookie)=>{const response=await fixture.json(route,body,cookie),value=await response.json();trace.push({route,status:response.status,value});return {status:response.status,value}}
    const call=async(name,args={},client=authorized.client)=>{const result=await client.callTool({name,arguments:args});trace.push({tool:name,arguments:args,result});return result}
    const value=async(name,args={},client=authorized.client)=>{const result=await call(name,args,client);assert.notEqual(result.isError,true,JSON.stringify(result));return toolValue(result)}
    const token=async(form)=>{const response=await fetch(fixture.origin+"/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(form)}),result=await response.json();trace.push({tokenGrant:form.grant_type,status:response.status,result:{...result,access_token:result.access_token?"issued":undefined,refresh_token:result.refresh_token?"issued":undefined}});return {status:response.status,value:result}}
    const begin=async(overrides={})=>{const params=new URLSearchParams(authorized.params);for(const [key,val]of Object.entries(overrides))params.set(key,val);const response=await fetch(fixture.origin+"/oauth/authorize?"+params,{redirect:"manual"});trace.push({authorize:overrides,status:response.status,location:response.headers.get("location")});return response}
    const reserve=async(id,units,actor="user-agent")=>{const result=await fixture.history.usage.reserve(owner.personId,{id,units,actor,request:id});trace.push({ledgerAdmission:{id,units,actor},result});return result}
    const result=await work({fixture,owner,authorized,api,call,value,token,begin,reserve,trace})
    const receipt={head,lane:number,verdict:"pass",database:fixture.url,clock:new Date(fixture.now()).toISOString(),...result}
    await save(directory,"receipt.json",receipt);await save(directory,"trace.json",trace)
    await writeFile(path.join(directory,"terminal.txt"),`node bench/metered-mcp/probe.mjs lanes\nhead=${head}\nlane=${number} PASS\n${JSON.stringify(result,null,2)}\n`)
    if(number===1)await save(directory,"comparison.json",{head,baseline,baselineFeature:absent?"absent":"present",baselinePassClaim:false,headResult:result})
    process.stdout.write(`lane-${number} PASS ${path.join(directory,"receipt.json")}\n`)
  }catch(error){await save(directory,"trace.json",trace);await save(directory,"receipt.json",{head,lane:number,verdict:"fail",error:String(error)});throw error}finally{await fixture.close()}
}
const lanes=[
  async({value,call,reserve,fixture,owner})=>{
    assert.equal(absent,true);const context=await value("get_context"),slide=(await value("get_slide",{deckId:"deck",slideId:"s0"})).items[0]
    const edit=await value("apply_changes",{deckId:"deck",base:0,requestId:"lane1-edit",changes:[{kind:"set",target:"s0",value:{...slide,notes:"Lane one saved work"}}]})
    const used=(await fixture.history.usage.status(owner.personId)).used;await reserve("fill",10000-used)
    const result=await call("apply_changes",{deckId:"deck",base:1,requestId:"kept",changes:[{kind:"set",target:"s0",value:slide}]});assert.equal(result.isError,true)
    const blocked=toolValue(result);assert.equal(blocked.requestKept,true);assert.equal((await fixture.history.read(owner,"deck")).deck.slides[0].notes,"Lane one saved work")
    return {baselineFeature:"absent",context,edit,blocked}
  },
  async({fixture,owner,reserve,api,begin,authorized})=>{
    await reserve("before-monday",500);const before=(await api("/api/usage")).value
    fixture.advance(before.week.resetsAt-fixture.now());const after=(await api("/api/usage")).value;await api("/api/usage")
    assert.equal(after.used,0);assert.equal(new Date(after.week.startsAt).getUTCDay(),1);assert.equal(new Date(after.week.startsAt).getUTCHours(),8)
    const resets=(await fixture.history.usage.events(owner.personId)).filter(event=>event.kind==="weekly-reset");assert.equal(resets.length,1)
    const count=(await api("/api/agents")).value.length,response=await begin(),intent=new URL(response.headers.get("location")).searchParams.get("intent")
    const denied=await api("/api/agents/approval",{intent,allow:false}),redirect=new URL(denied.value.redirect)
    assert.equal(redirect.origin+redirect.pathname,authorized.registered.redirect_uris[0]);assert.equal(redirect.searchParams.get("error"),"access_denied");assert.equal((await api("/api/agents")).value.length,count)
    return {before,after,resetEvents:resets,denied:denied.value}
  },
  async({fixture,owner,api,begin,authorized})=>{
    const spring=usageWeek(Date.parse("2026-03-04T12:00:00Z"),"America/New_York"),fall=usageWeek(Date.parse("2026-10-28T12:00:00Z"),"America/New_York")
    assert.equal((spring.resetsAt-spring.startsAt)/3600000,167);assert.equal((fall.resetsAt-fall.startsAt)/3600000,169)
    const response=await begin(),url=new URL(response.headers.get("location")),intent=url.searchParams.get("intent");fixture.advance(25*3600000)
    const expired=(await api("/api/agents/approval?intent="+encodeURIComponent(intent))).value;assert.equal(expired.expired,true);assert.equal(expired.client,"Local reference agent");assert.equal(expired.scope,"decks")
    const restart=new URL(expired.restart);assert.equal(restart.searchParams.get("redirect_uri"),authorized.registered.redirect_uris[0]);assert.equal(restart.searchParams.get("resource"),fixture.origin+"/mcp")
    const restarted=await fetch(restart,{redirect:"manual"});assert.equal(restarted.status,302);const fresh=new URL(restarted.headers.get("location")).searchParams.get("intent")
    assert.equal((await api("/api/agents/approval",{intent:fresh+"x",allow:true},owner.cookie)).status,400)
    const allowed=await api("/api/agents/approval",{intent:fresh,allow:true},owner.cookie);assert.equal(new URL(allowed.value.redirect).origin+new URL(allowed.value.redirect).pathname,authorized.registered.redirect_uris[0])
    return {spring,fall,expired,authenticatedReturn:allowed.value}
  },
  async({fixture,api,reserve,begin,authorized,token})=>{
    await reserve("before-zone",321);const before=(await api("/api/usage")).value,configured=(await api("/api/usage/configure",{zone:"America/New_York"})).value
    assert.equal(configured.used,321);assert.deepEqual(configured.week,before.week);assert.equal(configured.pendingZone,"America/New_York")
    fixture.advance(before.week.resetsAt-fixture.now());const applied=(await api("/api/usage")).value;assert.equal(applied.week.zone,"America/New_York");assert.equal(applied.used,0)
    for(const overrides of [{redirect_uri:"https://attacker.invalid"},{resource:fixture.origin+"/other"},{code_challenge_method:"plain"}])assert.equal((await begin(overrides)).status,400)
    assert.equal((await api("/oauth/register",{client_name:"unsafe",redirect_uris:["http://example.com/callback"]})).status,400)
    const approval=await begin(),intent=new URL(approval.headers.get("location")).searchParams.get("intent"),decision=await api("/api/agents/approval",{intent,allow:true}),code=new URL(decision.value.redirect).searchParams.get("code"),form={...authorized.form,code}
    for(const override of [{code_verifier:""},{code_verifier:"x".repeat(43)},{resource:fixture.origin+"/other"}])assert.equal((await token({...form,...override})).status,400)
    assert.equal((await token(form)).status,200)
    const metadata=(await api("/.well-known/oauth-authorization-server")).value,resource=(await api("/.well-known/oauth-protected-resource/mcp")).value
    assert.deepEqual(metadata.code_challenge_methods_supported,["S256"]);assert.equal(resource.resource,fixture.origin+"/mcp")
    return {before,configured,applied,metadata,resource,pin:mcpPin}
  },
  async({fixture,owner,reserve,api,authorized,token})=>{
    await fixture.history.usage.grantFixture(owner.personId,"credit",500,"paid");await reserve("fill",10000);const status=(await api("/api/usage")).value
    const results=await Promise.all([api("/api/usage/reset",{limitHit:status.hit}),api("/api/usage/reset",{limitHit:status.hit})]);assert.ok(results.every(result=>result.status===200))
    const events=(await fixture.history.usage.events(owner.personId)).filter(event=>event.kind==="credit-reset");assert.equal(events.length,1);assert.equal((await api("/api/usage")).value.paid,0)
    const form={grant_type:"refresh_token",client_id:authorized.registered.client_id,refresh_token:authorized.tokens.refresh_token,resource:fixture.origin+"/mcp"},rotated=await Promise.all([token(form),token(form)])
    assert.deepEqual(rotated.map(result=>result.status).sort(),[200,400]);const issued=rotated.find(result=>result.status===200).value
    const refused=await fetch(fixture.origin+"/mcp",{headers:{authorization:`Bearer ${issued.access_token}`}});assert.equal(refused.status,401)
    return {resetResults:results,resetEvents:events,parallelRefreshStatuses:rotated.map(result=>result.status),familyAccessStatus:refused.status}
  },
  async({fixture,owner,reserve,api,authorized,token})=>{
    await reserve("fill",10000);const hit=(await api("/api/usage")).value;fixture.advance(hit.week.resetsAt-fixture.now());await api("/api/usage")
    await fixture.history.usage.grantFixture(owner.personId,"late-fixture",500,"paid");const stale=await api("/api/usage/reset",{limitHit:hit.hit});assert.equal(stale.status,400);const after=(await api("/api/usage")).value;assert.equal(after.paid,500);assert.equal(after.used,0)
    const connection=(await api("/api/agents")).value[0];assert.equal((await api(`/api/agents/${connection.id}/revoke`,{})).status,200)
    const access=await fetch(fixture.origin+"/mcp",{headers:{authorization:`Bearer ${authorized.tokens.access_token}`}});assert.equal(access.status,401)
    assert.equal((await token({grant_type:"refresh_token",client_id:authorized.registered.client_id,refresh_token:authorized.tokens.refresh_token,resource:fixture.origin+"/mcp"})).status,400)
    return {lateGrantTrustedOnly:true,staleReset:stale,after,revokedAccessStatus:access.status}
  },
  async({fixture,owner,reserve,call,value,api})=>{
    await reserve("refund",7);await fixture.history.usage.settle(owner.personId,"refund","platform-refunded");await fixture.history.usage.settle(owner.personId,"refund","platform-refunded")
    const events=await fixture.history.usage.events(owner.personId),refunds=events.filter(event=>event.kind==="platform-refunded");assert.equal(refunds.length,1);assert.equal(refunds[0].data.debit,"debit:refund");assert.equal((await api("/api/usage")).value.used,0)
    const stranger=await fixture.signIn("other7@example.com"),other=await fixture.authorize(stranger.cookie)
    const job=await value("export_deck",{deckId:"deck",savedVersion:0,format:"pptx",requestId:"export"}),image=(await api("/api/assets/provider",{provider:"local-stock",item:"blue-marble",requestId:"image"})).value
    await finishImage(fixture,image)
    const ready=await value("get_operation",{operationId:image.id});assert.equal(ready.kind,"ready")
    await assert.rejects(other.client.readResource({uri:ready.resource}))
    const adopted=await api(`/api/assets/jobs/${image.id}/adopt`,{});assert.equal(adopted.status,200)
    const media=await fetch(fixture.origin+`/api/assets/${adopted.value.id}/original`,{headers:{cookie:stranger.cookie}});assert.equal(media.status,404)
    const requests=[["get_deck",{deckId:"deck"}],["get_operation",{operationId:job.operationId}],["get_operation",{operationId:image.id}],["capture_slide",{deckId:"deck",slideId:"s0",savedVersion:0}]]
    for(const [name,args]of requests)assert.equal((await call(name,args,other.client)).isError,true)
    return {refunds,wrongOwnerRefused:requests.map(([name,args])=>({name,args})),imageResource:ready.resource,foreignImageStatus:media.status,balance:(await api("/api/usage")).value}
  },
  async({fixture,owner,reserve,call,value,api})=>{
    const slide=(await value("get_slide",{deckId:"deck",slideId:"s0"})).items[0]
    const changes=[{kind:"set",target:"s0",value:{...slide,notes:"Finish current atomic change"}}]
    await reserve("fill",9999);const finished=await value("apply_changes",{deckId:"deck",base:0,requestId:"finish",changes});assert.equal((await fixture.history.read(owner,"deck")).seq,1)
    const stale=await call("apply_changes",{deckId:"deck",base:0,requestId:"stale",changes:[...changes,{kind:"remove",target:"s1"}]});assert.equal(stale.isError,true);assert.equal((await fixture.history.read(owner,"deck")).deck.slides.length,55)
    const refused=await call("apply_changes",{deckId:"deck",base:1,requestId:"waiting",changes});assert.equal(refused.isError,true);const blocked=toolValue(refused);assert.equal(blocked.requestKept,true);assert.equal(blocked.usage.resetLink,"/settings/usage");assert.equal(blocked.usage.paid+blocked.usage.bonus,0);assert.ok(blocked.usage.week.resetsAt>fixture.now())
    assert.equal((await api("/api/decks/deck/commands",{id:"manual",kind:"patch",base:1,run:null,target:"s0",fields:{notes:"Manual editing remains available"}})).status,200)
    assert.equal((await fixture.history.usage.events(owner.personId)).filter(event=>event.kind==="request-kept").length,1)
    return {finished,stale:toolValue(stale),blocked,savedWork:(await fixture.history.read(owner,"deck")).deck.slides[0].notes}
  },
  async({fixture,owner,reserve,api,value,call})=>{
    await fixture.history.usage.grantFixture(owner.personId,"funded",2000,"paid");await reserve("fill",10000,"aira");assert.equal((await reserve("blocked",1,"aira")).kind,"out-of-usage")
    const before=(await api("/api/usage")).value;await value("get_brand",{brandId:"light"});const assets=await value("search_assets",{source:"local-stock",query:""});assert.ok(assets.items.length>0)
    const job=await value("export_deck",{deckId:"deck",savedVersion:0,format:"pptx",requestId:"free-export"});assert.equal(job.kind,"queued")
    const pptx=await readFile("fixtures/pptx/native.pptx"),uploaded=await fetch(fixture.origin+"/api/mcp/uploads?name=native.pptx&requestId=free-upload",{method:"POST",headers:{origin:fixture.origin,cookie:owner.cookie,"content-type":"application/octet-stream"},body:pptx});assert.equal(uploaded.status,201)
    const source=await uploaded.json(),file=await value("add_file",{sourceUrl:source.sourceUrl,name:"native.pptx",requestId:"free-file"}),importJob=await value("import_deck",{fileId:file.fileId,requestId:"free-import"})
    const worker=new OperationStore(fixture.operationsPath,fixture.now)
    try{const claimed=worker.claim(operationId(importJob.operationId));assert.ok(claimed);const presentation=await importPptx(claimed.input);assert.equal(worker.complete(operationId(importJob.operationId),claimed.lease,await exportPptx(presentation),{...presentation.report,deck:importedDeck(presentation)}),true)}finally{worker.close()}
    const imported=await value("get_operation",{operationId:importJob.operationId});assert.equal(imported.kind,"ready");assert.ok(imported.deck.id)
    const stock=(await api("/api/assets/provider",{provider:"local-stock",item:"blue-marble",requestId:"free-stock"})).value;await finishImage(fixture,stock);assert.equal((await api(`/api/assets/jobs/${stock.id}/adopt`,{})).status,200)
    const first=await value("get_deck",{deckId:"deck"});assert.equal(first.items.length,20)
    assert.equal((await api("/api/decks/deck/commands",{id:"manual",kind:"patch",base:0,run:null,target:"s0",fields:{notes:"Concurrent manual edit"}})).status,200)
    const second=await value("get_deck",{deckId:"deck",cursor:first.nextCursor}),third=await value("get_deck",{deckId:"deck",cursor:second.nextCursor}),ids=[...first.items,...second.items,...third.items].map(item=>item.id)
    assert.equal(ids.length,55);assert.equal(new Set(ids).size,55);assert.equal(third.nextCursor,null)
    const after=(await api("/api/usage")).value;assert.equal(after.used,before.used);assert.equal(after.paid,2000)
    assert.equal((await call("apply_changes",{deckId:"deck",base:1,requestId:"remote-blocked",changes:[{kind:"remove",target:"s54"}]})).isError,true)
    return {before,after,freeExport:job,freeImport:imported,freeStock:stock.id,assetCount:assets.items.length,snapshot:{pageSizes:[first.items.length,second.items.length,third.items.length],ids}}
  },
  async({fixture,owner,reserve,api,call})=>{
    await fixture.history.usage.grantFixture(owner.personId,"credit",2500,"paid");await api("/api/usage/configure",{autoReset:true})
    await reserve("fill",3334,"aira");for(let index=0;index<3;index++)assert.equal((await reserve(`automatic-${index}`,3334,"aira")).kind,"admitted")
    assert.equal((await reserve("fourth",1,"aira")).kind,"out-of-usage");const after=(await api("/api/usage")).value;assert.equal(after.automaticResets,3);assert.equal(after.paid,1000)
    assert.equal((await reserve("remote",1)).kind,"out-of-usage");assert.equal((await api("/api/usage")).value.paid,1000)
    const image=await call("capture_slide",{deckId:"deck",slideId:"s0",savedVersion:0,width:960});assert.notEqual(image.isError,true);const native=image.content.find(item=>item.type==="image");assert.equal(native.mimeType,"image/png");const metadata=await sharp(Buffer.from(native.data,"base64")).metadata();assert.equal(metadata.width,960)
    const text=image.content.filter(item=>item.type!=="image"),bytes=Buffer.byteLength(JSON.stringify(text));assert.ok(bytes<20000)
    return {after,nativePng:{width:metadata.width,height:metadata.height,bytes:Buffer.from(native.data,"base64").length},metadataBytes:bytes,remoteCreditsAfter:1000}
  },
]
async function perf(){
  const fixture=await mcpFixture(),directory=path.join(root,"perf"),samples={},cold={},limits={admission:50,read:500,edit:1000,capture:2000,slowAck:1000},start=performance.now(),cpu=process.cpuUsage()
  try{
    const owner=await fixture.signIn("perf@example.com"),authorized=await fixture.authorize(owner.cookie),client=authorized.client;assert.equal((await fixture.json("/api/decks",fixtureDeck(12),owner.cookie)).status,201)
    let sequence=0,maxNonImageBytes=0
    const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args});assert.notEqual(result.isError,true,JSON.stringify(result));if(!result.content.some(item=>item.type==="image")){const bytes=Buffer.byteLength(JSON.stringify(result));maxNonImageBytes=Math.max(bytes,maxNonImageBytes);assert.ok(bytes<20000)}return result}
    const workloads={
      admission:async index=>{const result=await fixture.history.usage.reserve(owner.personId,{id:`perf-${index}`,actor:"user-agent",request:`perf-${index}`,units:1});assert.equal(result.kind,"admitted");assert.equal(result.duplicate,false)},
      read:async()=>{const slide=toolValue(await call("get_slide",{deckId:"deck",slideId:"s0"}));assert.equal(slide.items[0].elements.length,12)},
      edit:async index=>{const current=await fixture.history.read(owner,"deck"),slide=current.deck.slides[0],notes=`Measured edit ${index}`;const result=toolValue(await call("apply_changes",{deckId:"deck",base:sequence,requestId:`perf-edit-${index}`,changes:[{kind:"set",target:"s0",value:{...slide,notes}}]}));assert.ok(result);sequence++;const saved=await fixture.history.read(owner,"deck");assert.equal(saved.seq,sequence);assert.equal(saved.deck.slides[0].notes,notes)},
      capture:async()=>{const result=await call("capture_slide",{deckId:"deck",slideId:"s0",savedVersion:sequence,width:960}),native=result.content.find(item=>item.type==="image");assert.equal(native.mimeType,"image/png");const image=await sharp(Buffer.from(native.data,"base64")).metadata();assert.equal(image.width,960);assert.equal(image.height,540)},
      slowAck:async index=>{const result=toolValue(await call("export_deck",{deckId:"deck",savedVersion:sequence,format:"pptx",requestId:`perf-export-${index}`}));assert.equal(result.kind,"queued");assert.ok(result.operationId)},
    }
    for(const [name,work]of Object.entries(workloads)){
      let began=performance.now();await work("cold");cold[name]=performance.now()-began;samples[name]=[]
      for(let index=0;index<100;index++){began=performance.now();await work(index);samples[name].push(performance.now()-began)}
      process.stdout.write(`perf ${name} samples=100\n`)
    }
    const retries=await Promise.all(Array.from({length:8},()=>fixture.history.usage.reserve(owner.personId,{id:"concurrent-retry",actor:"user-agent",request:"same atomic request",units:1})));assert.equal(retries.filter(result=>!result.duplicate).length,1)
    const catalog=await client.listTools(),catalogBytes=Buffer.byteLength(JSON.stringify(catalog)),estimatorTokens=Math.ceil(catalogBytes/4);assert.equal(catalog.tools.length,18);assert.ok(estimatorTokens<=8000)
    const metrics=Object.fromEntries(Object.entries(samples).map(([name,values])=>{const sorted=[...values].sort((a,b)=>a-b),p95=sorted[94],p50=sorted[49];return [name,{count:100,p50,p95,min:sorted[0],max:sorted[99],limit:limits[name],pass:p95<=limits[name]}]}))
    const verdict={head,metrics,tools:catalog.tools.length,catalogBytes,estimatorTokens,estimator:"ceil(UTF-8 JSON bytes / 4)",maxNonImageBytes,duplicateDebits:0,pass:Object.values(metrics).every(metric=>metric.pass),wallMs:performance.now()-start,cpu:process.cpuUsage(cpu),resource:process.resourceUsage()}
    await save(directory,"raw.json",{head,cold,samples});await save(directory,"metric.json",{head,pin:mcpPin,definition:"One unique 1-unit durable PostgreSQL admission; full JSON slide with 12 elements; saved full-subtree note edit and observed sequence; uncached Chromium PNG at 960x540; queue-only export ACK at exact saved sequence. Each cold trial precedes 100 sequential warm samples; each sample asserts its intended end state. Local loopback MCP SDK client. Read validation is inside timing; edit includes shared-history before/after reads and capture includes PNG decoding, conservatively bounding user-visible RPC.",limiter:"PostgreSQL serialized account/history transactions for admission/edits; local HTTP and snapshot persistence for reads; Chromium page/font/render/screenshot plus PNG resize for capture; durable SQLite enqueue for slow ACK. No public latency/vendor/model claims.",uncertainty:"Single local 100-sample run on a shared 8-core host. Raw distribution and cold trials retained. Absolute budgets only; baseline lacks these features. No relative speedup claim."})
    await save(directory,"baseline.json",{baseline,head,feature:absent?"absent":"present",comparison:"No comparable main implementation. Absolute C07 budgets apply."});await save(directory,"verdict.json",verdict)
    process.stdout.write(JSON.stringify(verdict)+"\n");assert.equal(verdict.pass,true)
  }finally{await fixture.close()}
}
if(process.argv[2]==="perf")await perf()
else for(let index=0;index<lanes.length;index++)await runLane(index+1,lanes[index])
