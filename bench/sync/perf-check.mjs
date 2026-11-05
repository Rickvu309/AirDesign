import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import os from "node:os"
import { performance } from "node:perf_hooks"
import { chromium } from "playwright"
import { expect } from "playwright/test"
import { localStack } from "./local-stack.mjs"
import { browserClient, queue } from "./scenarios.mjs"
import { createHistoryStore } from "../../apps/server/src/db/history-store.ts"
import { commandId } from "../../packages/change-log/src/index.ts"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"

const output=process.env.P04_OUTPUT ?? `${os.homedir()}/tmp/airdesign-autopilot/P04`
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]
const summary=values=>({n:values.length,p50:percentile(values,.5),p95:percentile(values,.95),min:Math.min(...values),max:Math.max(...values)})
await mkdir(`${output}/perf`,{recursive:true})
const stack=await localStack(), browser=await chromium.launch()
let store
try {
  store=await createHistoryStore({kind:"postgres",url:stack.url})
  const person={personId:"perf"}, deck={...fixtureDeck(5,2),id:"performance"}
  await store.create(person,deck)
  const raw={head,cold:[],warm:[],replay:[],paint:[],recovery:[],connection:[],cpu:[]}
  let seq=0
  async function commit(label) {
    const started=performance.now()
    const receipt=await store.commit(person,deck.id,{id:commandId(`perf_${seq}`),kind:"patch",base:seq,run:null,target:"s0",fields:{notes:label}})
    const elapsed=performance.now()-started
    seq++;assert.equal(receipt.kind,"applied");assert.equal(receipt.seq,seq)
    return elapsed
  }
  await store.close()
  for(let trial=0;trial<3;trial++) {
    await stack.restart()
    const sample=JSON.parse(execFileSync(process.execPath,["bench/sync/cold-commit.mjs",stack.url,deck.id,String(seq)],{encoding:"utf8"}))
    seq++;assert.equal(sample.seq,seq);raw.cold.push(sample)
  }
  store=await createHistoryStore({kind:"postgres",url:stack.url})
  for(let index=0;index<20;index++) await commit(`warmup ${index}`)
  for(let run=0;run<5;run++) {
    const cpu=process.cpuUsage(), start=performance.now(), values=[]
    for(let index=0;index<100;index++)values.push(await commit(`run ${run} sample ${index}`))
    raw.cpu.push({elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu)})
    raw.warm.push({run,values,...summary(values)})
  }
  for(const depth of [seq,2000]) {
    while(seq<depth)await commit(`history ${seq}`)
    const values=[]
    for(let index=0;index<100;index++) {
      const start=performance.now(), replay=await store.replay(person,deck.id,depth-100)
      values.push(performance.now()-start)
      assert.equal(replay.head,depth);assert.equal(replay.events.length,100);assert.equal(replay.events[0].seq,depth-99);assert.equal(replay.events.at(-1).seq,depth)
    }
    const state=await stack.database(async db=>{const result=await db.query("SELECT octet_length(state::text) AS bytes,jsonb_array_length(state->'events') AS retained_events FROM editing_deck WHERE id=$1",[deck.id]);return result.rows[0]})
    assert.equal(state.retained_events,0)
    raw.replay.push({depth,values,state,...summary(values)})
  }
  for(let index=0;index<30;index++){const start=performance.now();await stack.database(db=>db.query("SELECT 1"));raw.connection.push(performance.now()-start)}
  raw.queryPlan=await stack.database(async db=>(await db.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT payload FROM editing_property WHERE deck=$1 AND node='s0' AND key='notes' AND active ORDER BY seq DESC LIMIT 1",[deck.id])).rows)
  const a=await browserClient(browser,stack.origin,"perf@example.com")
  const b=await browserClient(browser,stack.origin,"perf@example.com",{storageState:await a.context.storageState()})
  await b.context.addInitScript(()=>{
    window.paintSamples=[]
    const Native=WebSocket
    window.WebSocket=class extends Native {
      constructor(...args){super(...args);this.addEventListener("message",event=>{
        const message=JSON.parse(event.data)
        if(message.committedAt && message.kind==="snapshot")requestAnimationFrame(()=>requestAnimationFrame(()=>{
          const expected=message.deck.slides[0].notes, actual=document.querySelector('#sync-notes')?.value
          window.paintSamples.push({seq:message.seq,expected,actual,ms:Date.now()-message.committedAt})
        }))
      })}
    }
  })
  const headers={origin:stack.origin,"content-type":"application/json"}
  const response=await a.context.request.post(`${stack.origin}/api/decks`,{headers,data:{...fixtureDeck(5,2),id:"browserperf"}})
  assert.equal(response.status(),201)
  await a.open("browserperf");await b.open("browserperf")
  for(let index=0;index<110;index++) {
    const value=`visible sample ${index}`
    await a.notes.fill(value);await a.saved();await expect(b.notes).toHaveValue(value)
    await b.page.waitForFunction(count=>window.paintSamples.length>=count,index+1)
  }
  raw.paint=await b.page.evaluate(()=>window.paintSamples.slice(10))
  await writeFile(`${output}/perf/paint-debug.json`,JSON.stringify(raw.paint,null,2))
  assert.equal(raw.paint.length,100);assert(raw.paint.every(sample=>sample.actual===sample.expected && sample.ms>=0))
  for(let trial=0;trial<5;trial++) {
    await a.offline()
    await a.page.evaluate(trial=>{
      const field=document.querySelector('#sync-notes')
      const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set
      for(let index=0;index<100;index++){set.call(field,`recovery ${trial} command ${index}`);field.dispatchEvent(new Event("input",{bubbles:true}))}
    },trial)
    await expect.poll(async()=>(await queue(a,"browserperf")).length).toBe(100)
    const pending=await queue(a,"browserperf");assert.equal(pending.length,100)
    assert.equal(new Set(pending.map(item=>item.command.id)).size,100)
    assert.deepEqual(pending.map(item=>item.command.kind==="patch" ? item.command.fields.notes : null),Array.from({length:100},(_,index)=>`recovery ${trial} command ${index}`))
    const before=(await (await a.context.request.get(`${stack.origin}/api/decks/browserperf`)).json()).seq
    a.control.offline=false
    const start=performance.now()
    await a.page.getByRole("button",{name:"Reconnect",exact:true}).click();await a.saved();await expect(b.notes).toHaveValue(`recovery ${trial} command 99`)
    const elapsed=performance.now()-start
    const snapshot=await (await a.context.request.get(`${stack.origin}/api/decks/browserperf`)).json()
    assert.equal(snapshot.seq,before+100);assert.equal((await queue(a,"browserperf")).length,0)
    raw.recovery.push({trial,count:100,from:before,to:snapshot.seq,ms:elapsed})
  }
  await a.context.close();await b.context.close()
  const warm=summary(raw.warm.flatMap(run=>run.values)), paint=summary(raw.paint.map(sample=>sample.ms)), recovery=summary(raw.recovery.map(sample=>sample.ms))
  const verdict={head,commit:{...warm,budgetMs:50,pass:warm.p95<=50},paint:{...paint,budgetMs:100,pass:paint.p95<=100},recovery:{...recovery,budgetMs:2000,pass:recovery.max<=2000},boundedReplay:{pass:raw.replay.every(sample=>sample.state.retained_events===0),depths:raw.replay.map(sample=>({depth:sample.depth,p95:sample.p95,bytes:sample.state.bytes}))}}
  await writeFile(`${output}/perf/raw.json`,JSON.stringify(raw,null,2))
  await writeFile(`${output}/perf/verdict.json`,JSON.stringify(verdict,null,2))
  await writeFile(`${output}/perf/metric.json`,JSON.stringify({head,node:process.version,platform:process.platform,cpus:os.cpus().length,load:os.loadavg(),postgres:"18.6 local unix socket",browser:browser.version(),definitions:{commit:"await store.commit including BEGIN, owner row lock, immutable receipt lookup, property index updates, event, projection and COMMIT; pooled database connection per sample",paint:"server Date.now immediately after commit to second requestAnimationFrame in the receiving authenticated client; observed textarea must equal committed value",recovery:"Reconnect click through both clients showing final value and sender Saved after 100 distinct persisted commands; server seq must advance exactly 100",replay:"100 missing events at two history depths, 100 samples each; current projection retains zero historical events; indexed property lookup plan included"},cold:"three first commits in fresh Node processes after server child restart, with initialization and total measured separately; database buffers remain warm",limiter:{connection:summary(raw.connection),cpu:raw.cpu,explanation:"Serialized local database roundtrips and transaction durability; fresh connection control and process CPU/wall samples quantify avoided connection overhead. Query plan bounds active property lookup to one index result. Browser paint includes frame scheduling."},uncertainty:{commitP95Range:raw.warm.map(run=>run.p95),recoveryRange:raw.recovery.map(run=>run.ms)},claim:"Absolute C07 budgets, no comparable trunk implementation"},null,2))
  const paths=execFileSync("git",["ls-tree","-r","--name-only","45cfb965491c94a18e44386465095f1714073879","packages/change-log","packages/rpc","apps/server/src/db","apps/studio/src/sync"],{encoding:"utf8"})
  assert.equal(paths,"")
  await writeFile(`${output}/perf/baseline.json`,JSON.stringify({head,trunk:"45cfb965491c94a18e44386465095f1714073879",comparable:false,proof:{command:"git ls-tree -r --name-only 45cfb965491c94a18e44386465095f1714073879 packages/change-log packages/rpc apps/server/src/db apps/studio/src/sync",output:paths}},null,2))
  process.stdout.write(JSON.stringify(verdict)+"\n")
  assert(Object.values(verdict).filter(value=>value && typeof value==="object").every(value=>value.pass))
} finally {await store?.close();await browser.close();await stack.close()}
