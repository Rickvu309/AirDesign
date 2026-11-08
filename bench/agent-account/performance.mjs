import assert from "node:assert/strict"
import pg from "pg"
import {scenario,save,head,toolValue,execute} from "./fixture.mjs"
import {fontDeck,assertFontChange,assertStylePaint,textStyleObservation} from "./font-contract.mjs"
const revision={head,dirty:(await execute("git",["status","--porcelain=v1"])).stdout}
const transactions=new WeakMap(),committed=[],original=pg.Client.prototype.query
pg.Client.prototype.query=function(query,params,...rest){
  const sql=typeof query==="string" ? query : query.text
  if(sql==="BEGIN")transactions.set(this,{})
  const transaction=transactions.get(this)
  if(transaction&&sql.startsWith("INSERT INTO editing_event"))transaction.edit={deck:params[0],seq:params[1],command:JSON.parse(params[2])}
  if(transaction&&sql.startsWith("INSERT INTO usage_payment_receipt"))transaction.payment=JSON.parse(params[2])
  const result=original.call(this,query,params,...rest)
  if(sql!=="COMMIT"||!result?.then)return result
  return result.then(value=>{if(transaction?.edit||transaction?.payment)committed.push({...transaction,wall:Date.now(),monotonic:performance.now()});transactions.delete(this);return value})
}
const warm=[],cold=[],preflight=process.env.P08_PERF_PREFLIGHT==="1",warmCount=preflight ? 3 : 100,coldCount=preflight ? 1 : 3
const perfFile=name=>`perf/${preflight ? "preflight/" : ""}${name}`
const evaluate=async(s,session,code)=>JSON.parse(await s.browser(session,"eval","-b",Buffer.from(code).toString("base64")))
async function sample(s,session,owner,id,index,kind){
  const text=`${kind} sample ${index}: a clear decision`,source=await s.stream(owner,id)
  const current=await s.request(owner,`/api/decks/${id}`),seed=fontDeck(id).slides[0].elements[0].runs
  await s.request(owner,`/api/decks/${id}/commands`,{id:`font_seed_${kind}_${index}`,kind:"patch",base:current.seq,run:null,target:"s0e0",fields:{runs:seed}})
  const before=await s.request(owner,`/api/decks/${id}`)
  await s.browser(session,"wait","--fn",`Number(document.querySelector(".studio-editor").dataset.seq)===${before.seq}`)
  const beforePaint=await evaluate(s,session,textStyleObservation)
  await save(perfFile(`sample-${kind}-${index}-before.json`),{revision,before,beforePaint})
  assert.ok(beforePaint.fonts.length>0,"rendered text styles must be observable")
  await install(s,session)
  const startedAt=performance.now()
  const start=await s.request(owner,`/api/aira?deck=${id}`,{action:"send",text,selection:["s0e0"]},202)
  const first=await s.until(source,value=>value.run?.id===start.id&&value.run.events.some(event=>event.name==="apply_changes")),streamAt=performance.now()
  if(first.run.kind==="working")await s.until(source,value=>value.run?.id===start.id&&value.run.kind!=="working")
  const after=await s.request(owner,`/api/decks/${id}`),apply=s.commits.find(entry=>entry.run===start.id)
  await save(perfFile(`sample-${kind}-${index}-commit.json`),{revision,before,after,first,apply,committed})
  assertFontChange(before.deck,after.deck,["s0e0"])
  assert.ok(apply);assert.notEqual(apply.result.isError,true)
  const receipt=toolValue(apply.result),edit=committed.find(entry=>entry.edit?.command.id===receipt.id)
  assert.ok(edit,JSON.stringify({receipt,commands:committed.slice(-3)}))
  const seq=edit.edit.seq
  await s.browser(session,"wait","--fn",`Boolean(window.__airaPaints[${seq}])`)
  const paint=await evaluate(s,session,`window.__airaPaints[${seq}]`),afterPaint=await evaluate(s,session,textStyleObservation)
  await save(perfFile(`sample-${kind}-${index}-paint.json`),{revision,before,after,beforePaint,afterPaint,paint,commit:edit})
  assertStylePaint(beforePaint,afterPaint,paint,seq,before.deck.slides[0].elements[0].runs.map(run=>run.font))
  const checkout=(await s.request(owner,"/api/billing/checkout",{cents:1000})).payment
  await s.open(session,`/settings/usage?payment=${checkout.id}`,".payment-status")
  await s.browser(session,"wait","--fn",'document.querySelector(".payment-status")?.textContent.includes("Waiting")')
  await evaluate(s,session,`window.__paymentPaint=null;window.__paymentQueued=false;const expectedBalance=${JSON.stringify(`$${((index+1)*10).toFixed(2)}`)};window.__paymentObserver=new MutationObserver(()=>{if(!window.__paymentQueued&&document.querySelector(".payment-status")?.textContent.includes("Credits added")&&document.querySelector(".credit-balance")?.textContent===expectedBalance){window.__paymentQueued=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__paymentPaint={wall:Date.now(),status:document.querySelector(".payment-status").textContent,balance:document.querySelector(".credit-balance").textContent}}))}});window.__paymentObserver.observe(document.body,{subtree:true,childList:true,characterData:true});true`)
  const receiptId=`perf_${kind}_${checkout.id}_${index}`,webhookStart=performance.now();await s.webhook({id:receiptId,payment:checkout.id,kind:"paid",cents:1000});const ackAt=performance.now()
  const paymentCommit=committed.find(entry=>entry.payment?.id===receiptId&&entry.payment?.payment===checkout.id);assert.ok(paymentCommit)
  await s.browser(session,"wait","--fn","Boolean(window.__paymentPaint)")
  const paymentPaint=await evaluate(s,session,"window.__paymentPaint");await save(perfFile(`sample-${kind}-${index}-payment.json`),{revision,paymentPaint,paymentCommit,ackAt});assert.ok(paymentPaint.status.includes(checkout.id));assert.equal(paymentPaint.balance,`$${((index+1)*10).toFixed(2)}`);assert.equal((await s.request(owner,"/api/usage")).paid,(index+1)*1000)
  await s.open(session,`/deck/${id}`,".studio-editor")
  await install(s,session)
  await source.close()
  return {index,kind,run:start.id,request:text,scope:["s0e0"],seq,acceptedChanges:1,weightedUnits:3,firstCommittedChangeMs:edit.monotonic-startedAt,harnessReadDispatchMs:apply.start-startedAt,sharedApplyToolMs:apply.ack-apply.start,commitToActivityStreamMs:streamAt-edit.monotonic,commitToPaintMs:paint.wall-edit.wall,webhookRequestMs:ackAt-webhookStart,durableReceiptToAckMs:ackAt-paymentCommit.monotonic,verifiedCommitToResultPaintMs:paymentPaint.wall-paymentCommit.wall,payment:checkout.id,paint,paymentPaint}
}
async function install(s,session){
  await evaluate(s,session,`window.__airaObserver?.disconnect();window.__airaPaints={};window.__airaObserver=new MutationObserver(()=>{const seq=Number(document.querySelector(".studio-editor").dataset.seq);requestAnimationFrame(()=>requestAnimationFrame(()=>{const observation=${textStyleObservation};if(observation.seq===seq&&!window.__airaPaints[seq])window.__airaPaints[seq]={...observation,wall:Date.now()}}))});window.__airaObserver.observe(document.querySelector(".studio-editor"),{attributes:true,attributeFilter:["data-seq"]});true`)
}
async function trial(kind,count,offset){
  const s=await scenario({browserEnabled:true}),session=`p08-perf-${kind}-${offset}-${process.pid}`
  try{
    const owner=await s.fixture.signIn(`perf-${kind}-${offset}@example.com`),id=`perf_${kind}_${offset}`;await s.request(owner,"/api/decks",fontDeck(id),201);await s.login(session,owner);await s.open(session,`/deck/${id}`,".studio-editor");await install(s,session)
    const rows=[]
    for(let index=0;index<count;index++){rows.push(await sample(s,session,owner,id,index,kind));await save(perfFile(`progress-${kind}-${offset}.json`),{head,rows});if(index%20===19)console.log(`${kind}: ${index+1}/${count}`)}
    assert.equal((await s.request(owner,"/api/usage")).used,count*3)
    return rows
  }catch(error){await save(perfFile(`failure-${kind}-${offset}.json`),{revision,error:{name:error.name,message:error.message,stack:error.stack,stdout:error.stdout,stderr:error.stderr},trace:s.trace,commits:s.commits,committed});throw error}finally{await s.close()}
}
function percentile(values,p){return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]}
function uncertainty(values){const sorted=[...values].sort((a,b)=>a-b);return {method:"approximate binomial 95% order-statistic interval for population p95",low:sorted[89],high:sorted[99]}}
try{
  warm.push(...await trial("warm",warmCount,0))
  for(let index=0;index<coldCount;index++)cold.push(...await trial("cold",1,index))
  const fields=["firstCommittedChangeMs","harnessReadDispatchMs","sharedApplyToolMs","commitToActivityStreamMs","commitToPaintMs","webhookRequestMs","durableReceiptToAckMs","verifiedCommitToResultPaintMs"],summary=Object.fromEntries(fields.map(field=>{const values=warm.map(row=>row[field]);return [field,{n:values.length,min:Math.min(...values),p50:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values),p95Interval:uncertainty(values)}]}))
  const samples=[...warm,...cold],receiptToAckMax=Math.max(...samples.map(row=>row.durableReceiptToAckMs)),creditToPaintMax=Math.max(...samples.map(row=>row.verifiedCommitToResultPaintMs))
  await save(perfFile("raw.json"),{revision,warm,cold})
  await save(perfFile("diagnostic.json"),{revision,preflight,summary,receiptToAckMax,creditToPaintMax,warmCount,coldCount})
  assert.ok(summary.commitToPaintMs.p95<=100);assert.ok(receiptToAckMax<=1000);assert.ok(creditToPaintMax<=2000)
  assert.ok(samples.every(row=>row.commitToPaintMs>=0&&row.durableReceiptToAckMs>=0&&row.verifiedCommitToResultPaintMs>=0))
  await save(perfFile("metric.json"),{revision,preflight,workload:`${warmCount} sequential warm requests; each selects one text element in a two-slide deck, reseeds the non-brand font outside the timed boundary, makes one actual brand-font shared-tool change (3 weighted units), and receives one signed $10 local receipt. ${coldCount} separate fresh browser/server/database cold trials.`,boundary:"PG Client COMMIT promise resolves before server continuation: clock wall ms for commit-to-rAF DOM paint, monotonic ms for dispatch/ACK/stream. Browser and server use the same host clock. Two requestAnimationFrame callbacks confirm an intervening browser frame, changed computed font with preserved text, updated payment status, displayed balance and saved sequence; this includes one extra frame and does not measure physical display scanout.",limiter:"Not isolated by this driver. Shared-tool transaction, MCP dispatch/read, stream and browser frame intervals are reported; payment fixture excludes external provider/network latency.",sampling:`${warmCount} warm plus ${coldCount} cold; new browser session and database for each cold trial. Warm samples sequential; no comparable trunk feature.`,realModel:"Deterministic local adapter only; accepted external X03 evidence is separate and is not rerun here",summary})
  await save(perfFile("verdict.json"),{revision,verdict:"pass",rules:{connectedPaintP95Ms:{budget:100,actual:summary.commitToPaintMs.p95},durableReceiptToAckMaxMs:{budget:1000,actual:receiptToAckMax},verifiedCreditCommitToResultMaxMs:{budget:2000,actual:creditToPaintMax}},sampleCounts:{warm:warm.length,cold:cold.length},relativeComparison:"N/A: trunk has no comparable Aira/payment surface",summary});console.log(JSON.stringify({head,verdict:"pass",summary}))
}finally{await save(perfFile("last-attempt.json"),{revision,warm,cold,committed});pg.Client.prototype.query=original}
