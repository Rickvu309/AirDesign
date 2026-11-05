import assert from "node:assert/strict"
import { expect } from "playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { fixtureDeck, fixtureElement } from "../../packages/deck/src/fixture.ts"
import { signIn } from "./local-stack.mjs"

export async function browserClient(browser,origin,email,options={}) {
  const context=await browser.newContext({viewport:{width:1470,height:1000},...options})
  const person=options.storageState ? (await (await context.request.get(`${origin}/api/account`)).json()).personId : await signIn(context,origin,email)
  const control={offline:false,loseAck:false,lost:null,frames:[],outgoing:[],attempts:0,inbound:()=>{}}
  await context.route("**/api/**",route=>control.offline ? route.abort("internetdisconnected") : route.continue())
  await context.routeWebSocket("**/ws**",socket=>{
    control.attempts++
    if(control.offline){socket.close();return}
    const server=socket.connectToServer()
    control.inbound=message=>socket.send(JSON.stringify(message))
    server.onMessage(data=>{
      const message=JSON.parse(String(data))
      control.frames.push(message)
      if(control.loseAck && message.kind==="receipt") {control.loseAck=false;control.lost=message;control.offline=true;socket.close();return}
      socket.send(data)
    })
    socket.onMessage(data=>{control.outgoing.push(JSON.parse(String(data)));server.send(data)})
  })
  await context.addInitScript(()=>{
    const Socket=WebSocket
    window.WebSocket=class extends Socket {
      constructor(url,protocols){super(url,protocols);this.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.marker)window.receivedSyncMarker=message.marker})}
    }
  })
  const page=await context.newPage()
  const errors=[]
  page.on("pageerror",error=>errors.push(error.message))
  async function open(deck) {await page.goto(`${origin}/sync-fixture?deck=${deck}`);await page.locator("main[data-ready=true]").waitFor();await saved()}
  async function saved(){await page.locator('main[data-sync-state="saved"]').waitFor({timeout:15000})}
  async function offline(){control.offline=true;await page.evaluate(()=>window.dispatchEvent(new Event("offline")));await page.locator('main[data-sync-state="offline"],main[data-sync-state="retrying"]').waitFor()}
  async function reconnect(){control.offline=false;await page.getByRole("button",{name:"Reconnect",exact:true}).click();await saved()}
  return {context,person,page,control,errors,open,saved,offline,reconnect,notes:page.getByLabel("Speaker notes",{exact:true})}
}

export async function queue(client,deck) {
  return client.page.evaluate(({person,deck})=>new Promise((resolve,reject)=>{
    const opened=indexedDB.open("airdesign-outbox")
    opened.onsuccess=()=>{
      const db=opened.result,key=JSON.stringify([person,deck])
      const modern=db.objectStoreNames.contains("commands")
      const request=modern ? db.transaction("commands").objectStore("commands").getAll(IDBKeyRange.bound([key],[key,[]])) : db.transaction("queues").objectStore("queues").get(key)
      request.onsuccess=()=>{resolve(modern ? request.result.sort((a,b)=>a.queuedAt-b.queuedAt).map(row=>row.pending) : request.result ?? []);db.close()}
      request.onerror=()=>reject(request.error)
    }
    opened.onerror=()=>reject(opened.error)
  }),{person:client.person,deck})
}

export async function runLanes({browser,stack,output,capture=async()=>{},contextOptions={}}) {
  const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
  const a=await browserClient(browser,stack.origin,"p04-owner@example.com",contextOptions)
  const b=await browserClient(browser,stack.origin,"p04-owner@example.com",{...contextOptions,storageState:await a.context.storageState()})
  const traces=new Map(), receipts=[]
  let lane=0
  async function call(client,path,method="GET",data,credential) {
    const response=await client.context.request.fetch(stack.origin+path,{method,headers:{origin:stack.origin,...(credential ? {"x-run-credential":credential} : {}),...(method==="GET" ? {} : {"content-type":"application/json"})},...(data===undefined ? {} : {data})})
    const value=await response.json()
    const list=traces.get(lane) ?? [];list.push({path,method,status:response.status(),request:data,response:value});traces.set(lane,list)
    return {status:response.status(),value}
  }
  async function create(deck) { const value={...fixtureDeck(5,2),id:deck};assert.equal((await call(a,"/api/decks","POST",value)).status,201);return value }
  const credentials=new Map()
  async function command(deck,value,client=a){
    const credential=(value.kind==="edit" || value.kind==="patch") && value.run!==null ? credentials.get(JSON.stringify([deck,value.run])) : undefined
    const result=(await call(client,`/api/decks/${deck}/commands`,"POST",value,credential)).value
    if(value.kind==="start-run" && result.runCredential)credentials.set(JSON.stringify([deck,value.run]),result.runCredential)
    return result
  }
  async function snapshot(deck){return (await call(a,`/api/decks/${deck}`)).value}
  const cid=name=>`${lane}_${name}`
  async function patch(deck,name,fields,run=null,base=0,target="s0",client=a){return command(deck,{id:cid(name),kind:"patch",base,run,target,fields},client)}
  async function start(deck,run){return command(deck,{id:cid(`start_${run}`),kind:"start-run",run})}
  async function record(values) {
    assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[])
    const receipt={head,lane,verdict:"pass",...values}
    receipts.push(receipt)
    await capture(`lane-${lane}`,a,b)
    if(output){const folder=`${output}/lane-${lane}`;await mkdir(folder,{recursive:true});await writeFile(`${folder}/${lane===1 ? "comparison" : "receipt"}.json`,JSON.stringify(receipt,null,2));await writeFile(`${folder}/trace.json`,JSON.stringify({head,responses:traces.get(lane),aFrames:a.control.frames,bFrames:b.control.frames},null,2))}
    a.control.frames=[];b.control.frames=[]
  }
  try {
    {
    lane=1
    await create("laneone");await a.open("laneone");await b.open("laneone")
    await a.notes.fill("client A");await a.saved();await expect(b.notes).toHaveValue("client A")
    await b.notes.fill("client B");await b.saved();await expect(a.notes).toHaveValue("client B")
    await a.offline();await a.notes.fill("offline and reloaded")
    const before=await queue(a,"laneone");assert.equal(before.length,1)
    await a.page.reload();await a.page.locator('main[data-sync-state="offline"],main[data-sync-state="retrying"]').waitFor()
    assert.deepEqual(await queue(a,"laneone"),before)
    await a.reconnect();await expect(b.notes).toHaveValue("offline and reloaded")
    const parallelBase=(await snapshot("laneone")).seq
    await Promise.all([a.offline(),b.offline()]);await a.notes.fill("parallel A");await b.notes.fill("parallel B")
    const parallelIds=[...(await queue(a,"laneone")),...(await queue(b,"laneone"))].map(item=>item.command.id)
    await Promise.all([a.reconnect(),b.reconnect()])
    const parallel=await snapshot("laneone")
    assert.equal(parallel.seq,parallelBase+2);await expect(a.notes).toHaveValue(parallel.deck.slides[0].notes);await expect(b.notes).toHaveValue(parallel.deck.slides[0].notes)
    const parallelEvents=(await call(a,`/api/decks/laneone/events?after=${parallelBase}`)).value.events
    assert.deepEqual(parallelEvents.map(event=>event.command.id).sort(),parallelIds.sort())
    assert.equal((await queue(a,"laneone")).length,0);assert.equal((await queue(b,"laneone")).length,0)
    await record({parallelReconnect:{from:parallelBase,to:parallel.seq,ids:parallelIds,events:parallelEvents},trunk:{sha:"45cfb965491c94a18e44386465095f1714073879",w07:"absent",w09:"absent",proof:"git ls-tree at trunk has no change-log, rpc, server db/commands/rpc or Studio sync"},headResult:await snapshot("laneone"),reloadStableId:before[0].command.id})

    }
    {
    lane=2
    await create("lanetwo");await a.open("lanetwo");await b.open("lanetwo")
    await start("lanetwo","old");await patch("lanetwo","person",{notes:"protected"},null,1)
    const old=await patch("lanetwo","old",{notes:"forbidden"},"old",2);assert.equal(old.code,"person-protected");await expect(b.notes).toHaveValue("protected");await capture("old-run-refused",a,b)
    await start("lanetwo","new");const newer=await patch("lanetwo","new",{notes:"new epoch"},"new",3);assert.equal(newer.kind,"applied");await expect(b.notes).toHaveValue("new epoch");await capture("new-run-accepted",a,b)
    await a.offline();await a.notes.fill("queued person wins");const queued=await queue(a,"lanetwo")
    const agent=await patch("lanetwo","intervening",{notes:"intervening agent"},"new",4);assert.equal(agent.kind,"applied")
    await expect(b.notes).toHaveValue("intervening agent")
    await a.reconnect();await expect(b.notes).toHaveValue("queued person wins")
    const after=await snapshot("lanetwo")
    const late=await patch("lanetwo","late",{notes:"forbidden again"},"new",after.seq);assert.equal(late.code,"person-protected")
    await record({old,newer,agent,late,queuedIds:queued.map(item=>item.command.id),final:after})

    }
    {
    lane=3
    await create("lanethree");const independent=await Promise.all([patch("lanethree","notes",{notes:"notes"}),patch("lanethree","size",{size:{width:900,height:600}},null,0,"s0",b)])
    assert(independent.every(receipt=>receipt.kind==="applied"));let snap=await snapshot("lanethree");assert.equal(snap.deck.slides[0].notes,"notes");assert.equal(snap.deck.slides[0].size.width,900)
    await a.open("lanethree");await b.open("lanethree")
    a.control.inbound({kind:"snapshot",deck:{...fixtureDeck(5,2),id:"lanethree"},seq:0,marker:"stale-cache-regression"})
    await a.page.waitForFunction(()=>window.receivedSyncMarker==="stale-cache-regression")
    const cacheAfterStale=await a.page.evaluate(person=>JSON.parse(localStorage.getItem(JSON.stringify(["snapshot",person,"lanethree"])))?.seq,a.person)
    assert.equal(cacheAfterStale,snap.seq)
    assert.equal(Number(await a.page.locator("main").getAttribute("data-seq")),snap.seq)
    a.control.loseAck=true;await a.notes.fill("lost acknowledgment")
    await a.page.locator('main[data-sync-state="offline"],main[data-sync-state="retrying"]').waitFor()
    assert(a.control.lost);const lost=a.control.lost.receipt;const pending=await queue(a,"lanethree");assert.equal(pending[0].command.id,lost.id)
    await a.reconnect();const retried=a.control.frames.find(message=>message.kind==="receipt" && message.receipt.id===lost.id)
    assert.deepEqual(retried.receipt,lost);snap=await snapshot("lanethree");assert.equal(snap.seq,lost.seq)
    await record({independent,cacheAfterStale,lost,retried:retried.receipt,final:snap})

    }
    {
    lane=4
    await create("lanefour");await start("lanefour","adopt")
    const childTemplate=fixtureElement(0)
    const child={...childTemplate,id:"adopted",box:{...childTemplate.box,y:250}}, untouched={...fixtureElement(1),id:"untouched"}
    await command("lanefour",{id:cid("insert"),kind:"edit",run:"adopt",base:1,changes:{changes:[{kind:"insert",parent:"s0",index:0,value:child},{kind:"insert",parent:"s0",index:1,value:untouched},{kind:"remove",target:"s0e1"}]}})
    await patch("lanefour","person",{runs:[{...child.runs[0],text:"person adopted this child"}]},null,2,"adopted")
    await command("lanefour",{id:cid("move"),kind:"edit",base:3,run:null,changes:{changes:[{kind:"move",target:"adopted",parent:"s1",index:0}]}})
    await a.open("lanefour");await b.open("lanefour")
    for(const client of [a,b]) {
      await client.page.getByLabel("Slide",{exact:true}).selectOption("s1")
      const adoptedText=client.page.getByRole("textbox",{name:"Text adopted"})
      await expect(adoptedText).toHaveText("person adopted this child")
      const childBounds=await adoptedText.boundingBox(), titleBounds=await client.page.getByRole("textbox",{name:"Text s1e0"}).boundingBox()
      assert(childBounds && titleBounds && childBounds.y>=titleBounds.y+titleBounds.height,"adopted child must remain readable below the slide title")
    }
    await capture("adoption-before-undo",a,b)
    const undo=await command("lanefour",{id:cid("undo"),kind:"undo-run",run:"adopt"});assert.equal(undo.kind,"applied")
    const adopted=await snapshot("lanefour");assert.equal(adopted.deck.slides[1].elements[0].id,"adopted");assert.equal(adopted.deck.slides[1].elements[0].runs[0].text,"person adopted this child");assert(adopted.deck.slides[0].elements.some(element=>element.id==="s0e1"));assert(!JSON.stringify(adopted.deck).includes('"untouched"'))
    for(const client of [a,b])await expect(client.page.getByRole("textbox",{name:"Text adopted"})).toHaveText("person adopted this child")
    await capture("adoption-after-undo",a,b)
    for(const client of [a,b])await client.page.getByLabel("Slide",{exact:true}).selectOption("s0")
    await a.offline();await a.notes.fill("queue survives reload");const beforeReload=await queue(a,"lanefour");await a.page.reload();await a.page.locator('main[data-sync-state="offline"],main[data-sync-state="retrying"]').waitFor();const afterReload=await queue(a,"lanefour");assert.deepEqual(afterReload,beforeReload);await a.reconnect()
    await record({undo,adopted,beforeReload,afterReload})

    }
    {
    lane=5
    await create("lanefive");await start("lanefive","move")
    await command("lanefive",{id:cid("move"),kind:"edit",base:1,run:"move",changes:{changes:[{kind:"move",target:"s0e1",parent:"s1",index:0}]}})
    await command("lanefive",{id:cid("person_move"),kind:"edit",base:2,run:null,changes:{changes:[{kind:"move",target:"s0e1",parent:"s0",index:4}]}})
    const movedUndo=await command("lanefive",{id:cid("undo"),kind:"undo-run",run:"move"});assert.equal(movedUndo.kind,"applied");const moved=await snapshot("lanefive");assert.equal(moved.deck.slides[0].elements[4].id,"s0e1")
    await a.open("lanefive");await b.open("lanefive");const known=moved.seq
    await a.offline();await patch("lanefive","missed_a",{notes:"missing A"});await patch("lanefive","missed_b",{notes:"missing B"})
    await stack.restart();a.control.frames=[];await a.reconnect();await b.page.getByRole("button",{name:"Reconnect",exact:true}).click();await b.saved();await expect(a.notes).toHaveValue("missing B")
    const replay=a.control.frames.filter(message=>message.kind==="replay").flatMap(message=>message.events);assert.deepEqual(replay.map(event=>event.seq),[known+1,known+2]);const restarted=await snapshot("lanefive");assert.equal(Number(await a.page.locator("main").getAttribute("data-seq")),restarted.seq)
    await record({movedUndo,moved,known,replayedSequences:replay.map(event=>event.seq),restarted,processRestart:true})

    }
    {
    lane=6
    await create("lanesix");await start("lanesix","stale");await patch("lanesix","person",{notes:"person"},null,1)
    const stale=await command("lanesix",{id:cid("stale_batch"),kind:"edit",base:1,run:"stale",changes:{changes:[{kind:"set",target:"s0e1",value:{...fixtureElement(1),id:"s0e1",fill:"#ff0000"}},{kind:"set",target:"s0",value:{...fixtureDeck(5,2).slides[0],notes:"stale overwrite"}}]}})
    assert.equal(stale.code,"stale-base");assert.equal(stale.command.changes.changes.length,2)
    await command("lanesix",{id:cid("remove"),kind:"edit",base:2,run:null,changes:{changes:[{kind:"remove",target:"s0e1"}]}})
    const removed=await patch("lanesix","late",{fill:"#ff0000"},null,1,"s0e1");assert.equal(removed.code,"invalid-reference");assert.equal(removed.restore,cid("remove"))
    await a.open("lanesix");await b.open("lanesix");assert.equal((await snapshot("lanesix")).seq,3)
    await record({stale,removed,final:await snapshot("lanesix")})

    }
    {
    lane=7
    await create("laneseven");const immutableCommand={id:cid("immutable"),kind:"patch",base:0,run:null,target:"s0",fields:{notes:"immutable"}}
    const original=await command("laneseven",immutableCommand);await patch("laneseven","later",{notes:"later"});const retry=await command("laneseven",immutableCommand,b);assert.deepEqual(retry,original)
    await a.open("laneseven");await b.open("laneseven");await a.offline();await a.notes.fill("restore my removed slide");const recoverable=await queue(a,"laneseven")
    await command("laneseven",{id:cid("delete_slide"),kind:"edit",base:2,run:null,changes:{changes:[{kind:"remove",target:"s0"}]}})
    a.control.offline=false;await a.page.getByRole("button",{name:"Reconnect",exact:true}).click();await a.page.getByRole("button",{name:"Restore deleted slide and retry",exact:true}).waitFor();const rejected=await queue(a,"laneseven");assert.equal(rejected[0].command.id,recoverable[0].command.id);assert.equal(rejected[0].kind,"rejected")
    const restore=a.page.getByRole("button",{name:"Restore deleted slide and retry",exact:true})
    await expect(restore).toBeInViewport()
    await restore.focus();await a.page.keyboard.press("Tab");await a.page.keyboard.press("Shift+Tab");await expect(restore).toBeFocused()
    await capture("deleted-slide-restore-choice",a,b)
    await a.page.getByRole("button",{name:"Restore deleted slide and retry",exact:true}).click();await a.saved();await expect(a.notes).toHaveValue("restore my removed slide");await expect(b.notes).toHaveValue("restore my removed slide")
    await record({original,retry,recoverable,rejected,restored:await snapshot("laneseven")})

    }
    {
    lane=8
    await create("laneeight");const originalId={id:cid("same"),kind:"patch",base:0,run:null,target:"s0",fields:{notes:"original"}}
    await command("laneeight",originalId);const mismatch=await call(a,"/api/decks/laneeight/commands","POST",{...originalId,fields:{notes:"changed"}});assert.equal(mismatch.status,400);assert.equal(mismatch.value.code,"request-id-payload-mismatch");assert.equal((await snapshot("laneeight")).seq,1)
    await a.open("laneeight");await b.open("laneeight");await a.offline();await a.notes.fill("unsaved deleted deck");const retained=await queue(a,"laneeight");assert.equal((await call(a,"/api/decks/laneeight","DELETE")).status,200)
    a.control.offline=false;await a.page.getByRole("button",{name:"Reconnect",exact:true}).click();await a.page.locator('main[data-sync-state="deleted"]').waitFor();assert.deepEqual(await queue(a,"laneeight"),retained);assert.equal(await a.notes.isDisabled(),true);assert.equal(await a.page.getByRole("button",{name:"Export",exact:true}).isDisabled(),true)
    await a.page.reload();await a.page.locator('main[data-sync-state="deleted"]').waitFor({timeout:5000});assert.deepEqual(await queue(a,"laneeight"),retained);await expect(a.page.getByRole("button",{name:"Download unsaved changes",exact:true})).toBeEnabled();assert.equal(await a.notes.isDisabled(),true)
    await record({mismatch,retained,deletedState:await a.page.getByRole("status").textContent(),writesStopped:true,reloadKeepsRecovery:true})

    }
    {
    lane=9
    await create("lanenine");const durable={id:cid("durable"),kind:"patch",base:0,run:null,target:"s0",fields:{notes:"durable receipt"}}
    const committed=await command("lanenine",durable);await stack.restart();const restarted=await command("lanenine",durable);assert.deepEqual(restarted,committed)
    await a.open("lanenine");await b.open("lanenine");const attempts=a.control.attempts;const since=Date.now();await a.offline();await a.notes.fill("waiting safely");await a.page.locator('main[data-sync-state="retrying"]').waitFor({timeout:8000});const retryAt=Date.now()-since
    assert(retryAt>=2900 && retryAt<7000);assert.equal(await a.page.getByRole("button",{name:"Ask",exact:true}).isDisabled(),true);assert.equal(await a.page.getByRole("button",{name:"Export",exact:true}).isDisabled(),true);assert.equal((await queue(a,"lanenine")).length,1)
    await capture("offline-retrying",a,b);const retryAttempts=a.control.attempts-attempts;assert(retryAttempts<=3);await a.reconnect();await expect(b.notes).toHaveValue("waiting safely")
    await record({committed,restarted,retryAtMs:retryAt,retryAttempts,maxAutomaticRetries:3,askDisabledOffline:true,exportDisabledOffline:true})

    }
    {
    lane=10
    await create("laneten");await start("laneten","closed");await command("laneten",{id:cid("close"),kind:"close-run",run:"closed"});const late=await patch("laneten","late",{notes:"cannot resurrect"},"closed",2);assert.equal(late.code,"run-closed")
    await a.open("laneten");await b.open("laneten");await a.offline();await a.notes.fill("same account pending");const originalQueue=await queue(a,"laneten")
    const expired=await stack.database(db=>db.query('UPDATE airdesign.session SET "expiresAt"=\'2000-01-01 00:00:00\' WHERE "userId"=$1',[a.person]));assert(expired.rowCount>0);assert.equal((await call(a,"/api/account")).status,401)
    a.control.offline=false;await a.page.getByRole("button",{name:"Reconnect",exact:true}).click();await a.page.locator('main[data-sync-state="signed-out"]').waitFor();assert.deepEqual(await queue(a,"laneten"),originalQueue)
    await stack.database(db=>db.query("DELETE FROM airdesign.send_window"));const same=await signIn(a.context,stack.origin,"p04-owner@example.com");assert.equal(same,a.person);await a.reconnect();await expect(a.notes).toHaveValue("same account pending")
    await a.offline();await a.notes.fill("isolated old account");const isolated=await queue(a,"laneten")
    await call(a,"/api/session/revoke","POST",{});const other=await signIn(a.context,stack.origin,"p04-other@example.com");assert.notEqual(other,a.person)
    a.control.offline=false;await a.page.getByRole("button",{name:"Reconnect",exact:true}).click();await a.page.locator('main[data-sync-state="signed-out"]').waitFor();assert.deepEqual(await queue(a,"laneten"),isolated)
    const denied=await call(a,"/api/decks/laneten");assert.equal(denied.status,404)
    const otherQueue=await queue({...a,person:other},"laneten");assert.deepEqual(otherQueue,[])
    await record({late,expiredRetained:originalQueue,samePrincipalReauthenticated:same,isolatedQueue:isolated,otherPrincipal:other,otherQueue,crossOwnerStatus:denied.status})
    }
    return {head,receipts,errors:[...a.errors,...b.errors]}
  } finally {await a.context.close();await b.context.close()}
}
