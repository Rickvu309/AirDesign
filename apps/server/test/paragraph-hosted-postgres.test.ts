import {readFile} from "node:fs/promises"
import {performance} from "node:perf_hooks"
import {shadowTextSource, affineTextShadowXml} from "../../../packages/pptx/test/text-cascade-fixture.ts"
import {importPptx,exportPptx} from "../../../packages/pptx/src/index.ts"
import {importedNativeDeck} from "../../../packages/pptx/src/import-deck.ts"
import {writeNativeSavedPptx} from "../../../packages/pptx/src/export-deck.ts"
import {expect,it} from "vitest"
import pg from "pg"
import {assetProviders} from "../../../packages/files/src/assets/providers.ts"
import {validateImage} from "../../../packages/files/src/assets/validate.ts"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js"
import {claudeAdapter,type SdkQuery} from "../../../packages/agent/src/sdk-adapter.ts"
import {isNativeSlide} from "../../../packages/deck/src/text/native-v3.ts"
import {mcpFixture,toolValue} from "./mcp/fixture.ts"
import {deferred,eventStream} from "./agent/stream.ts"
import {fontDeck} from "./agent/font-fixture.ts"
import {localAdapter} from "../../../packages/agent/src/local-adapter.ts"
import type {AgentAdapter} from "../../../packages/agent/src/harness.ts"
import {id} from "../../../packages/deck/src/index.ts"
import {flatten} from "../../../packages/deck/src/elements.ts"
import {nativeNodes} from "../../../packages/change-log/src/text/native-model.ts"
import {createParagraphHistoryStore} from "../src/db/paragraph-history-store.ts"
import {prepareParagraphCutover,pauseParagraphEditing} from "../src/db/paragraph-protocol.ts"
import {cutoverParagraphHistory} from "../src/db/paragraph-cutover.ts"

async function hostedFixture(adapter?:AgentAdapter,prepared=false){
  const f=await mcpFixture({agentAdapter:adapter}),sql=new pg.Client({connectionString:f.url}),native=createParagraphHistoryStore(f.url,f.now)
  try{
  await sql.connect()
  const owner=await f.signIn("paragraph-hosted@example.com"),auth=await f.authorize(owner.cookie)
  const entry=await f.history.catalog.create(owner,"seed","Native hosted","",fontDeck())
  const legacy=(await f.history.read(owner,entry.id)).deck,slide=legacy.slides[0]
  if(!slide)throw new Error("legacy-slide-required")
  const archivedRequest={deckId:entry.id,base:0,requestId:"archived-before-cutover",changes:[{kind:"set",target:slide.id,value:{...slide,notes:"Retained hosted input"}}]}
  const archivedResult=toolValue(await auth.client.callTool({name:"apply_changes",arguments:archivedRequest}))
  expect(archivedResult).toMatchObject({kind:"applied"})
  const archivedBrand={deck:entry.id,id:"light",version:1,mode:"apply-deck",family:"basic",requestId:"archived-brand"}
  const archivedBrandResult=prepared ? await (await f.json("/api/templates/apply",archivedBrand,owner.cookie)).json() : undefined
  if(prepared)expect(archivedBrandResult).toMatchObject({receipt:{kind:"applied"}})
  const archivedEvents=(await sql.query("SELECT command::text,receipt::text FROM editing_event WHERE deck=$1 ORDER BY seq",[entry.id])).rows
  const archivedReceipts=(await sql.query("SELECT payload,receipt::text FROM editing_receipt WHERE deck=$1 ORDER BY id",[entry.id])).rows
  expect((await f.json("/api/templates/from-deck",{deck:entry.id,id:"hosted-brand",name:"Hosted brand"},owner.cookie)).status).toBe(201)
  await prepareParagraphCutover(sql)
  await pauseParagraphEditing(sql,true)
  await cutoverParagraphHistory(sql,{pause:{kind:"paused",drafts:"retained-or-visibly-refused",oldReaders:"retired"},lockBudgetMs:1000,conversionBudgetMs:30000})
  await pauseParagraphEditing(sql,false)
  async function http(route:string,body?:unknown,protocol="paragraph-body-v3",cookie=owner.cookie){return fetch(f.apiOrigin+route,{method:body===undefined ? "GET" : "POST",headers:{origin:f.origin,cookie,"content-type":"application/json","x-text-protocol":protocol},body:body===undefined ? undefined : JSON.stringify(body)})}
  async function rawTool(name:string,args:Record<string,unknown>={}){
    const response=await fetch(f.apiOrigin+"/mcp",{method:"POST",headers:{authorization:`Bearer ${auth.tokens.access_token}`,"content-type":"application/json",accept:"application/json, text/event-stream","mcp-protocol-version":"2025-11-25","x-text-protocol":"paragraph-body-v3"},body:JSON.stringify({jsonrpc:"2.0",id:name,method:"tools/call",params:{name,arguments:args}})})
    const body=await response.json()
    return {response,body}
  }
  async function tool(name:string,args:Record<string,unknown>={}){const result=await rawTool(name,args);return result.response.ok ? toolValue(result.body.result) : result.body}
  return {...f,owner,entry,sql,native,http,tool,rawTool,archivedBrand,archivedBrandResult,archivedRequest,archivedResult,archivedEvents,archivedReceipts,async close(){await native.close();await sql.end();await f.close()}}
  }catch(error){await native.close();await sql.end();await f.close();throw error}
}

it("executes hosted native reads, independent formatting and protected undo through durable PostgreSQL history",async()=>{
  const f=await hostedFixture()
  try{
    const deckId=f.entry.id,initial=await f.native.read(f.owner,deckId),slide=initial.deck.slides[0],text=slide?.elements[0]
    if(text?.kind!=="text"||!slide)throw new Error("native-text-required")
    expect(await f.tool("apply_changes",f.archivedRequest)).toEqual(f.archivedResult)
    expect(await f.tool("apply_changes",{...f.archivedRequest,changes:[{kind:"set",target:slide.id,value:{...slide,notes:"Changed retry"}}]})).toMatchObject({code:"request-id-payload-mismatch"})
    expect(await f.tool("get_context")).toMatchObject({textProtocol:"paragraph-body-v3"})
    const brand=await f.tool("get_brand",{brandId:"hosted-brand"})
    const branded=await f.tool("update_brand",{brandId:"hosted-brand",base:brand.version,requestId:"native-brand",tokens:{accent:"#abcdef"}})
    expect(branded).toMatchObject({version:brand.version+1,accent:"#abcdef"})
    expect(await f.tool("update_brand",{brandId:"hosted-brand",base:brand.version,requestId:"native-brand",tokens:{accent:"#abcdef"}})).toEqual(branded)
    const first=text.body.paragraphs[0],second={...first,id:id("hosted_second"),runs:[...first.runs]}
    const insert=await f.tool("apply_changes",{deckId,base:initial.seq,requestId:"second",changes:[{kind:"insert",parent:text.id,index:2,value:second}]})
    expect(insert,JSON.stringify(insert)).toMatchObject({kind:"applied"})
    expect((await f.tool("get_slide",{deckId,slideId:slide.id})).items).toEqual((await f.native.read(f.owner,deckId)).deck.slides.filter(item=>item.id===slide.id))
    expect((await f.tool("get_slide",{deckId,slideId:slide.id,rootId:first.id})).items).toEqual([first])
    expect(await f.tool("get_slide",{deckId,slideId:slide.id,rootId:text.id,format:"jsx"})).toMatchObject({items:[{jsx:expect.stringContaining('"body"')}]})
    expect((await f.tool("find_elements",{deckId,query:"clear direction",kind:"text"})).items).toContainEqual(expect.objectContaining({id:text.id,text:"A clear direction with evidence\nA clear direction with evidence"}))
    expect(await f.tool("find_elements",{deckId,kind:"paragraph"})).toMatchObject({items:expect.arrayContaining([expect.objectContaining({id:first.id,parent:text.id,kind:"paragraph"})])})
    const base=insert.savedVersion,change={deckId,base,requestId:"format-first",changes:[{kind:"set",target:first.id,value:{...first,alignment:"center",marker:{kind:"bullet",character:"•",font:"Arial",color:"#336699",size:{kind:"multiple",value:0.75}},glyphAlignment:"center",spacing:{...first.spacing,before:{kind:"multiple",value:0.5},after:12},endStyle:{...first.endStyle,italic:true,opacity:0.5,highlight:"#ffff00",letterSpacing:2,baseline:0.25,strike:true,capitalization:"small",kerning:12}}}]}
    const edited=await f.tool("apply_changes",change)
    expect(edited).toMatchObject({kind:"applied"})
    expect((await f.tool("get_slide",{deckId,slideId:slide.id,rootId:first.id})).items).toEqual([change.changes[0]!.value])
    expect(await f.tool("apply_changes",change)).toEqual(edited)
    expect(await f.tool("apply_changes",{...change,changes:[]})).toMatchObject({code:expect.any(String)})
    expect(await f.tool("apply_changes",{...change,changes:[{kind:"set",target:first.id,value:first}]})).toMatchObject({code:"request-id-payload-mismatch"})
    expect(await f.tool("apply_changes",{deckId,base,requestId:"independent",changes:[{kind:"set",target:second.id,value:{...second,alignment:"right"}}]})).toMatchObject({kind:"applied"})
    expect(await f.tool("apply_changes",{deckId,base,requestId:"stale-first",changes:[{kind:"set",target:first.id,value:first}]})).toMatchObject({kind:"refused",code:expect.stringContaining("stale")})
    let current=await f.native.read(f.owner,deckId)
    const person=await f.http(`/api/decks/${deckId}/commands`,{version:3,command:{id:"hosted_later_person",kind:"patch",target:first.id,fields:{alignment:"justify"},base:current.seq,run:null}})
    expect(await person.json()).toMatchObject({kind:"applied"})
    current=await f.native.read(f.owner,deckId)
    expect(await f.tool("undo_change",{deckId,base:current.seq,requestId:"undo-first",changeId:edited.changeId})).toMatchObject({kind:"applied"})
    current=await f.native.read(f.owner,deckId)
    expect(nativeNodes(current.deck).find(node=>node.id===first.id)?.fields).toMatchObject({alignment:"justify",marker:first.marker,endStyle:first.endStyle})
    expect(nativeNodes(current.deck).find(node=>node.id===second.id)?.fields.alignment).toBe("right")
    const frame={...text.body.frame,wrap:"none",compatibilityLineSpacing:true,verticalFlow:"vertical270",anchor:"bottom",insets:{top:4,right:5,bottom:6,left:7},autofit:{kind:"shrink",fontScale:0.9,lineReduction:0.1}}
    expect(await f.tool("apply_changes",{deckId,base:current.seq,requestId:"frame",changes:[{kind:"set",target:frame.id,value:frame}]})).toMatchObject({kind:"applied"})
    current=await f.native.read(f.owner,deckId)
    const protectedDeck=current.deck
    expect(await f.tool("apply_changes",{deckId,base:current.seq,requestId:"legacy-body-erasure",changes:[{kind:"set",target:text.id,value:{id:text.id,kind:"text",box:text.box,runs:first.runs}}]})).toMatchObject({code:"invalid-native-change",retryable:false})
    expect((await f.native.read(f.owner,deckId)).deck).toEqual(protectedDeck)
    expect(await f.tool("check_deck",{deckId,savedVersion:current.seq})).toMatchObject({valid:true})
    const capture=await f.rawTool("capture_slide",{deckId,slideId:slide.id,savedVersion:current.seq,width:320})
    expect(capture.body.result.content[0]).toMatchObject({type:"image",mimeType:"image/png"})
    expect(Buffer.from(capture.body.result.content[0].data,"base64").subarray(1,4).toString()).toBe("PNG")
    expect(Buffer.byteLength(JSON.stringify(capture.body.result))).toBeLessThan(500000)
    const job=await f.tool("export_deck",{deckId,savedVersion:current.seq,format:"pptx",requestId:"freeze"})
    expect(job).toMatchObject({kind:"queued"})
    const claim=await f.native.exports.claim()
    expect(claim).toMatchObject({id:job.operationId,snapshotVersion:3,snapshot:{seq:current.seq,deck:current.deck}})
    const stranger=await f.signIn("paragraph-hosted-stranger@example.com")
    expect((await f.http(`/api/decks/${deckId}`,undefined,"paragraph-body-v3",stranger.cookie)).status).toBe(404)
    const old=await f.http(`/api/decks/${deckId}`,undefined,"legacy-text-v2")
    expect(await old.json()).toMatchObject({code:"editing-protocol-mismatch"})
    const pending={deckId,base:current.seq,requestId:"retained-draft",changes:[{kind:"set",target:first.id,value:first}]}
    await pauseParagraphEditing(f.sql,true)
    expect(await f.tool("apply_changes",pending)).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    const pausedRequest={action:"send",text:"Retain this agent request during the update"}
    expect(await (await f.http(`/api/aira?deck=${deckId}`,pausedRequest)).json()).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect(pausedRequest.text).toBe("Retain this agent request during the update")
    expect(pending.requestId).toBe("retained-draft")
    await pauseParagraphEditing(f.sql,false)
    expect(await f.tool("apply_changes",pending)).toMatchObject({kind:"applied"})
    const reopen=createParagraphHistoryStore(f.url,f.now)
    try{expect(await reopen.read(f.owner,deckId)).toEqual(await f.native.read(f.owner,deckId))}finally{await reopen.close()}
    expect((await f.sql.query("SELECT command::text,receipt::text FROM editing_event WHERE deck=$1 AND history_version=2 ORDER BY seq",[deckId])).rows).toEqual(f.archivedEvents)
    expect((await f.sql.query("SELECT payload,receipt::text FROM editing_receipt WHERE deck=$1 AND history_version=2 ORDER BY id",[deckId])).rows).toEqual(f.archivedReceipts)
    expect((await f.sql.query("SELECT history_version FROM editing_event WHERE deck=$1 ORDER BY seq",[deckId])).rows.map(row=>row.history_version)).toEqual([2,...Array(current.seq).fill(3)])
  }finally{await f.close()}
})

it("uses native hosted tools for deterministic agent generation, frozen resume and later-person protection",async()=>{
  const accepted=deferred(),release=deferred();let attempts=0
  const adapter:AgentAdapter=async function*(context,call,signal){
    expect(context.textProtocol).toBe("paragraph-body-v3")
    const attempt=++attempts
    for await(const event of localAdapter(context,call,signal)){
      yield event
      if(attempt===1&&event.kind==="tool"&&event.name==="apply_changes"){
        signal.addEventListener("abort",()=>release.resolve(),{once:true});accepted.resolve();await release.promise
      }
    }
  }
  const f=await hostedFixture(adapter)
  try{
    const deckId=f.entry.id,stream=await eventStream(f.apiOrigin+`/api/aira/events?deck=${deckId}`,f.owner.cookie,{"x-text-protocol":"paragraph-body-v3"})
    try{
      const start=await (await f.http(`/api/aira?deck=${deckId}`,{action:"send",text:"Apply the saved brand to all slides"})).json()
      await accepted.promise
      expect((await f.http(`/api/aira?deck=${deckId}`,{action:"stop"})).status).toBe(200)
      const frozen=await f.native.agents.latest(f.owner.personId,deckId)
      expect(frozen).toMatchObject({id:start.id,kind:"stopped",request:"Apply the saved brand to all slides",completed:[expect.any(String)]})
      const before=await f.native.read(f.owner,deckId),first=before.deck.slides[0]?.elements[0]
      if(first?.kind!=="text")throw new Error("native-text-required")
      expect(first.body.paragraphs[0].runs.every(run=>run.style.font==="Geist")).toBe(true)
      const paragraph=first.body.paragraphs[0]
      expect(await (await f.http(`/api/decks/${deckId}/commands`,{version:3,command:{id:"agent_person",kind:"patch",target:paragraph.id,fields:{alignment:"right"},base:before.seq,run:null}})).json()).toMatchObject({kind:"applied"})
      expect((await f.http(`/api/aira?deck=${deckId}`,{action:"resume"})).status).toBe(202)
      let final
      do{final=await stream.next()}while(final.run?.id!==start.id||!["complete","failed"].includes(final.run.kind))
      expect(final.run).toMatchObject({id:start.id,kind:"complete",completed:before.deck.slides.map(slide=>slide.id),request:frozen?.request})
      expect((await f.http(`/api/aira?deck=${deckId}`,{action:"undo"})).status).toBe(200)
      const undone=await f.native.read(f.owner,deckId)
      expect(nativeNodes(undone.deck).find(node=>node.id===paragraph.id)?.fields).toMatchObject({alignment:"right"})
      const restored=undone.deck.slides[0]?.elements[0]
      if(restored?.kind!=="text")throw new Error("native-text-required")
      expect(restored.body.paragraphs[0].runs.map(run=>run.style.font)).toEqual(["Arial","Georgia"])
      const empty=await f.tool("create_deck",{title:"Agent native generation",requestId:"empty-agent"})
      const generatedStream=await eventStream(f.apiOrigin+`/api/aira/events?deck=${empty.id}`,f.owner.cookie,{"x-text-protocol":"paragraph-body-v3"})
      try{
        const generation=await (await f.http(`/api/aira?deck=${empty.id}`,{action:"send",text:"Create a title slide"})).json()
        let result
        do{result=await generatedStream.next()}while(result.run?.id!==generation.id||!["complete","failed"].includes(result.run.kind))
        expect(result.run).toMatchObject({kind:"complete"})
        const generated=await f.native.read(f.owner,empty.id),title=generated.deck.slides[0]?.elements[0]
        expect(title).toMatchObject({kind:"text",body:{paragraphs:[{runs:[{kind:"text",text:"New presentation"}]}]}})
        expect(title).not.toHaveProperty("runs")
        const reopened=createParagraphHistoryStore(f.url,f.now)
        try{expect(await reopened.read(f.owner,empty.id)).toEqual(generated);expect(await reopened.agents.latest(f.owner.personId,deckId)).toMatchObject({id:start.id,kind:"undone",completed:frozen?.completed?.length ? expect.any(Array) : []})}finally{await reopened.close()}
      }finally{await generatedStream.close()}
    }finally{await stream.close()}
  }finally{await f.close()}
})


it("dispatches a deterministic fake SDK model through the real native hosted tools without translating its body",async()=>{
  let formatted:string|undefined
  const query:SdkQuery=async function*({prompt,options}){
    yield* []
    if(typeof prompt==="string")throw new Error("streaming-context-required")
    const inputs=prompt[Symbol.asyncIterator](),initial=(await inputs.next()).value
    if(typeof initial?.message.content!=="string")throw new Error("context-required")
    const context=JSON.parse(initial.message.content)
    expect(context).toMatchObject({textProtocol:"paragraph-body-v3",request:"Center the first paragraph",completed:[]})
    expect(options?.systemPrompt).toContain("body-only text")
    expect(options?.tools).toEqual([])
    expect(options?.maxTurns).toBe(20)
    const server=options?.mcpServers?.airdesign
    if(!server||server.type!=="sdk")throw new Error("sdk-tool-server-required")
    const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair(),client=new Client({name:"deterministic-native-model",version:"1"})
    await server.instance.connect(serverTransport);await client.connect(clientTransport)
    try{
      const catalog=await client.listTools()
      expect(catalog.tools).toHaveLength(18)
      expect(Math.ceil(Buffer.byteLength(JSON.stringify(catalog))/4)).toBeLessThanOrEqual(8000)
      const call=async(name:string,input:Record<string,unknown>)=>toolValue(await client.callTool({name,arguments:{input}}))
      const deck=await call("get_deck",{deckId:context.deckId}),data=await call("get_slide",{deckId:context.deckId,slideId:deck.items[0].id}),slide=data.items[0]
      if(!isNativeSlide(slide)||slide.elements[0]?.kind!=="text")throw new Error("native-slide-required")
      const text=slide.elements[0],paragraph=text.body.paragraphs[0]
      formatted=paragraph.id
      const input={deckId:context.deckId,base:data.savedVersion,requestId:`model_${context.run}`,changes:[{kind:"set",target:paragraph.id,value:{...paragraph,alignment:"center"}}]}
      expect(await call("apply_changes",input)).toMatchObject({kind:"applied"})
      const result=await call("get_slide",{deckId:context.deckId,slideId:slide.id,rootId:text.id})
      expect(result.items[0]).toEqual({...text,body:{...text.body,paragraphs:[{...paragraph,alignment:"center"}]}})
    }finally{await client.close();await server.instance.close();await inputs.return?.()}
  }
  const f=await hostedFixture(claudeAdapter({key:"fake-no-network",model:"deterministic-test",query}))
  try{
    const stream=await eventStream(f.apiOrigin+`/api/aira/events?deck=${f.entry.id}`,f.owner.cookie,{"x-text-protocol":"paragraph-body-v3"})
    try{
      const start=await (await f.http(`/api/aira?deck=${f.entry.id}`,{action:"send",text:"Center the first paragraph"})).json()
      let result
      do{result=await stream.next()}while(result.run?.id!==start.id||!["complete","failed"].includes(result.run.kind))
      expect(result.run).toMatchObject({kind:"complete"})
      expect(formatted).toBeDefined()
      const reopened=createParagraphHistoryStore(f.url,f.now)
      try{expect(nativeNodes((await reopened.read(f.owner,f.entry.id)).deck).find(node=>node.id===formatted)?.fields.alignment).toBe("center")}finally{await reopened.close()}
    }finally{await stream.close()}
  }finally{await f.close()}
})

it("routes native template and image prepared edits through atomic history and reopens without body loss",async()=>{
  const f=await hostedFixture(undefined,true)
  try{
    const archivedRetry=await f.http("/api/templates/apply",f.archivedBrand)
    expect(archivedRetry.status).toBe(200)
    expect(await archivedRetry.json()).toMatchObject({receipt:f.archivedBrandResult.receipt})
    expect(await (await f.http("/api/templates/apply",{...f.archivedBrand,id:"dark"})).json()).toMatchObject({code:"request-id-payload-mismatch"})
    const deckId=f.entry.id,initial=await f.native.read(f.owner,deckId),slide=initial.deck.slides[0]!,text=slide.elements.find(element=>element.kind==="text")
    if(text?.kind!=="text")throw new Error("native-text-required")
    const rich=structuredClone(text)
    rich.body.frame.anchor="bottom"
    rich.body.frame.insets={top:1,right:2,bottom:3,left:4}
    rich.body.frame.autofit={kind:"shrink",fontScale:0.9,lineReduction:0.1}
    const first=rich.body.paragraphs[0]
    first.alignment="right"
    first.marker={kind:"bullet",character:"•"}
    first.runs.push({kind:"break",style:{...first.endStyle,italic:true}})
    rich.body.paragraphs.push({...structuredClone(first),id:id("httpTrailing"),runs:[],endStyle:{...first.endStyle,size:31,underline:true}})
    expect(await f.tool("apply_changes",{deckId,base:initial.seq,requestId:"http-rich-body",changes:[{kind:"set",target:text.id,value:rich}]})).toMatchObject({kind:"applied"})
    const before=structuredClone(rich.body),brand={deck:deckId,id:"dark",version:1,requestId:"http-brand",mode:"apply-deck",family:"basic"}
    const applied=await f.http("/api/templates/apply",brand)
    expect(applied.status).toBe(200)
    const receipt=await applied.json()
    expect(receipt).toMatchObject({receipt:{kind:"applied"}})
    expect(await (await f.http("/api/templates/apply",brand)).json()).toMatchObject({receipt:receipt.receipt})
    expect(await (await f.http("/api/templates/apply",{...brand,id:"light"})).json()).toMatchObject({code:"request-id-payload-mismatch"})
    expect(await (await f.http("/api/templates/from-deck",{deck:deckId,id:"native-brand",name:"Native saved brand"})).json()).toMatchObject({id:"native-brand"})
    expect((await f.native.read(f.owner,deckId)).deck.slides[0]!.elements.find(element=>element.id===text.id)).toMatchObject({body:before})
    const source=await assetProviders[1]!.read("blue-marble")
    const asset=await f.native.images.adopt(f.owner,await validateImage(source.bytes),source.provenance)
    expect(asset).toHaveProperty("id")
    const placement={deck:deckId,slide:slide.id,elementId:"httpPicture",requestId:"http-place",asset:asset.id,alt:"Retain paragraph draft"}
    const placed=await f.http("/api/assets/place",placement)
    expect(placed.status).toBe(200)
    const placedReceipt=await placed.json()
    expect(placedReceipt).toMatchObject({receipt:{kind:"applied"}})
    expect(await (await f.http("/api/assets/place",placement)).json()).toEqual(placedReceipt)
    expect(await (await f.http("/api/assets/place",{...placement,alt:"Changed"})).json()).toMatchObject({code:"request-id-payload-mismatch"})
    const updated=await f.http("/api/assets/update",{...placement,requestId:"http-crop",crop:{x:0.1,y:0,width:0.9,height:1}})
    expect(updated.status).toBe(200)
    let current=await f.native.read(f.owner,deckId)
    expect(nativeNodes(current.deck).find(node=>node.id==="httpPicture")?.fields).toMatchObject({kind:"image",image:{crop:{x:0.1}}})
    expect(nativeNodes(current.deck).find(node=>node.id===before.frame.id)).toBeDefined()
    expect(await (await f.http(`/api/decks/${deckId}/commands`,{version:3,command:{id:"undo-image",kind:"undo",target:"http-crop"}})).json()).toMatchObject({kind:"applied"})
    current=await f.native.read(f.owner,deckId)
    const stranger=await f.signIn("paragraph-callers-stranger@example.com")
    expect((await f.http("/api/assets/place",placement,"paragraph-body-v3",stranger.cookie)).status).toBe(404)
    expect((await f.http("/api/templates/apply",{...brand,requestId:"foreign"},"paragraph-body-v3",stranger.cookie)).status).toBe(404)
    const reopened=createParagraphHistoryStore(f.url,f.now)
    try{expect(await reopened.read(f.owner,deckId)).toEqual(current)}finally{await reopened.close()}
    await pauseParagraphEditing(f.sql,true)
    const retained={...placement,requestId:"paused-picture",alt:"Keep my unsaved input"}
    expect(await (await f.http("/api/assets/place",retained)).json()).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect(await (await f.http("/api/templates/apply",{...brand,requestId:"paused-brand"})).json()).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect((await f.sql.query("SELECT id FROM editing_receipt WHERE id LIKE 'paused-%'")).rows).toEqual([])
    await pauseParagraphEditing(f.sql,false)
    expect((await f.http("/api/assets/place",{...retained,elementId:"resumedPicture"})).status).toBe(200)
    expect((await f.http("/api/templates/apply",brand,"legacy-text-v2")).status).toBe(409)
    expect((await f.sql.query("SELECT command::text,receipt::text FROM editing_event WHERE deck=$1 AND history_version=2",[deckId])).rows).toEqual(f.archivedEvents)
    expect((await f.sql.query("SELECT payload,receipt::text FROM editing_receipt WHERE deck=$1 AND history_version=2 ORDER BY id",[deckId])).rows).toEqual(f.archivedReceipts)
  }finally{await f.close()}
})


it("admits independent imported text edits and refuses destructive field edits before sequence mutation with durable retries and frozen export", async()=>{
  const f=await hostedFixture()
  try{
    const original=await shadowTextSource(),bytes=await exportPptx(original)
    const entry=await f.native.catalog.create(f.owner,"source-capability","Source capability","",importedNativeDeck(original),{bytes,report:{...original.report}})
    let current=await f.native.read(f.owner,entry.id)
    const text=flatten(current.deck.slides[0]!.elements).find(element=>element.kind==="text"&&element.body.paragraphs.length===10)
    if(text?.kind!=="text")throw new Error("source-text-required")
    expect(text.body.paragraphs[9]!.runs[0]!.style.outerShadow).toMatchObject({scale:{x:1,y:0.3},skew:{x:21.67,y:0},rotateWithShape:false,opacity:0.32})
    const readback=await f.tool("get_slide",{deckId:entry.id,slideId:current.deck.slides[0]!.id,rootId:text.body.paragraphs[9]!.id,format:"json"})
    expect(readback.items[0].runs[0].style.outerShadow).toEqual(text.body.paragraphs[9]!.runs[0]!.style.outerShadow)
    const jsx=await f.tool("get_slide",{deckId:entry.id,slideId:current.deck.slides[0]!.id,rootId:text.body.paragraphs[9]!.id,format:"jsx"})
    expect(jsx.items[0].jsx).toContain("outerShadow")
    expect(text.body.frame.spacingAtEdges).toBe(true)
    expect(text.body.paragraphs[9]!.tabSize).toBe(48)
    expect(text.body.paragraphs[9]!.runs[0]!.style.symbolFont).toBe("Wingdings")
    const paragraph=text.body.paragraphs[9]!,input={deckId:entry.id,base:current.seq,requestId:"independent-source-edit",changes:[{kind:"set",target:paragraph.id,value:{...paragraph,runs:paragraph.runs.map((run,index)=>index===0&&run.kind==="text"?{...run,text:"Retained person input"}:run)}}]}
    const started=performance.now(),applied=await f.tool("apply_changes",input)
    console.log(JSON.stringify({measurement:"hosted-source-cascade-10-paragraph-edit",milliseconds:performance.now()-started,sourceBytes:bytes.length,result:applied}))
    expect(applied).toMatchObject({kind:"applied"})
    expect(await f.tool("apply_changes",input)).toEqual(applied)
    current=await f.native.read(f.owner,entry.id)
    const frozen=await f.tool("export_deck",{deckId:entry.id,savedVersion:current.seq,format:"pptx",requestId:"source-freeze"}),claim=await f.native.exports.claim()
    expect(claim).toMatchObject({id:frozen.operationId,snapshotVersion:3})
    if(!claim||claim.snapshotVersion!==3)throw new Error("native-frozen-source-required")
    const exported=await importPptx(await writeNativeSavedPptx(claim.snapshot.deck,claim.snapshot.seq,bytes,{})),xml=exported.parts.get("ppt/slides/slide1.xml")!.toString()
    expect(xml).toContain('type="slidenum"><a:t>42</a:t>')
    expect(xml).toContain('<a:hlinkClick r:id="retained-link" tooltip="Original"/>')
    expect(xml).toContain("Retained person input")
    expect(xml.split(affineTextShadowXml).length).toBe(3)
    expect(xml).toContain('<a:sym typeface="Wingdings" pitchFamily="2" charset="2"/>')
    for(const [part,value]of original.parts)if(!["[Content_Types].xml","ppt/slides/slide1.xml"].includes(part))expect(exported.parts.get(part),part).toEqual(value)
    const destructive={deckId:entry.id,base:current.seq,requestId:"destructive-source-edit",changes:[{kind:"set",target:paragraph.id,value:{...input.changes[0]!.value,runs:paragraph.runs.map((run,index)=>index===1&&run.kind==="text"?{...run,text:"Caller draft retained"}:run)}}]}
    const refused=await f.tool("apply_changes",destructive)
    expect(refused).toMatchObject({kind:"refused",code:expect.stringContaining("source-text-format-preservation-required")})
    expect(await f.tool("apply_changes",destructive)).toEqual(refused)
    expect(await f.tool("apply_changes",{...destructive,changes:input.changes})).toMatchObject({code:"request-id-payload-mismatch"})
    expect(await f.native.read(f.owner,entry.id)).toMatchObject({seq:current.seq,deck:current.deck})
    const shadowDraft={deckId:entry.id,base:current.seq,requestId:"source-shadow-draft",changes:[{kind:"set",target:paragraph.id,value:{...input.changes[0]!.value,runs:input.changes[0]!.value.runs.map((run,index)=>index===0&&run.style.outerShadow?{...run,style:{...run.style,outerShadow:{...run.style.outerShadow,distance:99}}}:run)}}]}
    const shadowHeads=(await f.sql.query("SELECT * FROM editing_key WHERE deck=$1 ORDER BY node,key",[entry.id])).rows
    const immutableEvents=(await f.sql.query("SELECT command::text,receipt::text FROM editing_event WHERE deck=$1 ORDER BY seq",[entry.id])).rows
    const shadowRefusal=await f.tool("apply_changes",shadowDraft)
    const immutableShadowReceipt=(await f.sql.query("SELECT payload,receipt::text FROM editing_receipt WHERE deck=$1 AND receipt->>'code'=$2",[entry.id,shadowRefusal.code])).rows
    expect(shadowRefusal).toMatchObject({kind:"refused",code:expect.stringContaining("source text shadow is source controlled")})
    expect(await f.tool("apply_changes",shadowDraft)).toEqual(shadowRefusal)
    expect(await f.tool("apply_changes",{...shadowDraft,changes:input.changes})).toMatchObject({code:"request-id-payload-mismatch"})
    expect(await f.native.read(f.owner,entry.id)).toMatchObject({seq:current.seq,deck:current.deck})
    expect((await f.sql.query("SELECT * FROM editing_key WHERE deck=$1 ORDER BY node,key",[entry.id])).rows).toEqual(shadowHeads)
    expect((await f.sql.query("SELECT payload,receipt::text FROM editing_receipt WHERE deck=$1 AND receipt->>'code'=$2",[entry.id,shadowRefusal.code])).rows).toEqual(immutableShadowReceipt)
    expect(immutableShadowReceipt).toHaveLength(1)
    expect(JSON.stringify(immutableShadowReceipt)).toContain("Retained person input")
    expect(JSON.stringify(immutableShadowReceipt)).toContain("99")
    expect((await f.sql.query("SELECT command::text,receipt::text FROM editing_event WHERE deck=$1 ORDER BY seq",[entry.id])).rows).toEqual(immutableEvents)
    const group=current.deck.slides[0]!.elements.find(element=>element.kind==="group")
    if(group?.kind!=="group"||!group.coordinateSpace)throw new Error("source-group-required")
    const beforeIndexes=(await f.sql.query("SELECT * FROM editing_key WHERE deck=$1 ORDER BY node,key",[entry.id])).rows
    const geometry={deckId:entry.id,base:current.seq,requestId:"source-geometry-draft",changes:[{kind:"set",target:group.id,value:{...group,coordinateSpace:{...group.coordinateSpace,x:group.coordinateSpace.x+1}}}]}
    const geometryRefusal=await f.tool("apply_changes",geometry)
    expect(geometryRefusal).toMatchObject({kind:"refused",code:expect.stringContaining("source group coordinates or topology")})
    expect(await f.tool("apply_changes",geometry)).toEqual(geometryRefusal)
    expect(await f.native.read(f.owner,entry.id)).toMatchObject({seq:current.seq,deck:current.deck})
    expect((await f.sql.query("SELECT * FROM editing_key WHERE deck=$1 ORDER BY node,key",[entry.id])).rows).toEqual(beforeIndexes)
    const stored=(await f.sql.query("SELECT receipt FROM editing_receipt WHERE deck=$1 AND receipt->>'kind'='refused'",[entry.id])).rows
    expect(JSON.stringify(stored)).toContain("Caller draft retained")
    const reopened=createParagraphHistoryStore(f.url,f.now)
    try{expect(await reopened.read(f.owner,entry.id)).toMatchObject({seq:current.seq,deck:current.deck})}finally{await reopened.close()}
    expect(await f.tool("undo_change",{deckId:entry.id,base:current.seq,requestId:"undo-source",changeId:applied.changeId})).toMatchObject({kind:"applied"})
    const undone=await f.native.read(f.owner,entry.id)
    expect(nativeNodes(undone.deck).find(node=>node.id===paragraph.id)?.fields.runs).toEqual(paragraph.runs)
    expect(claim.snapshot.deck).toEqual(current.deck)
  }finally{await f.close()}
})


it("measures the real hosted source-edit path with DALRRD and twenty persisted commands", async()=>{
  const f=await hostedFixture()
  try{
    const bytes=await readFile(new URL("../../../packages/pptx/test/corpus/dalrrd.pptx",import.meta.url)),original=await importPptx(bytes),deck=importedNativeDeck(original)
    const entry=await f.native.catalog.create(f.owner,"measured-dalrrd","DALRRD command path","",deck,{bytes,report:{...original.report}})
    let current=await f.native.read(f.owner,entry.id)
    const text=current.deck.slides[0]!.elements.find(element=>element.kind==="text")
    if(text?.kind!=="text")throw new Error("corpus-text-required")
    const paragraph=text.body.paragraphs[0],timings:number[]=[]
    for(let index=0;index<20;index++){
      const started=performance.now(),result=await f.tool("apply_changes",{deckId:entry.id,base:current.seq,requestId:`measured-source-${index}`,changes:[{kind:"set",target:paragraph.id,value:{...paragraph,alignment:index%2===0?"center":"right"}}]})
      timings.push(performance.now()-started)
      expect(result).toMatchObject({kind:"applied"})
      current=await f.native.read(f.owner,entry.id)
    }
    const count=(await f.sql.query("SELECT count(*)::integer AS count FROM editing_event WHERE deck=$1",[entry.id])).rows[0].count
    expect(count).toBe(20)
    console.log(JSON.stringify({measurement:"hosted-dalrrd-source-edit-20-command-history",sourceBytes:bytes.length,slides:deck.slides.length,commands:count,milliseconds:timings}))
    const reopened=createParagraphHistoryStore(f.url,f.now)
    try{expect(await reopened.read(f.owner,entry.id)).toMatchObject({seq:20,deck:current.deck})}finally{await reopened.close()}
  }finally{await f.close()}
},120000)

it("persists edits, undo and frozen exports for the three original corpus shadow identities", async () => {
  const f = await hostedFixture()
  try {
    for (const fixture of [{name: "dalrrd", slide: 3, objectId: "text:1"}, {name: "dalrrd", slide: 22, objectId: "text:3"}, {name: "performance", slide: 1, objectId: "text:0,1,2"}]) {
      const bytes = await readFile(new URL(`../../../packages/pptx/test/corpus/${fixture.name}.pptx`, import.meta.url)), source = await importPptx(bytes), part = `ppt/slides/slide${fixture.slide}.xml`
      const entry = await f.native.catalog.create(f.owner, `shadow-${fixture.name}-${fixture.slide}`, "Source shadow", "", importedNativeDeck(source), {bytes, report: source.report})
      const initial = await f.native.read(f.owner, entry.id), slide = initial.deck.slides.find(slide => slide.source.kind === "original" && slide.source.part === part)!, text = flatten(slide.elements).find(element => element.source.kind === "original" && element.source.objectId === fixture.objectId)
      if (text?.kind !== "text") throw new Error("original-shadow-native-required")
      const paragraph = text.body.paragraphs.at(-1)!, value = {...paragraph, runs: paragraph.runs.map(run => ({...run, style: {...run.style, bold: !run.style.bold}}))}
      const request = {deckId: entry.id, base: initial.seq, requestId: "original-shadow-edit", changes: [{kind: "set", target: paragraph.id, value}]}, applied = await f.tool("apply_changes", request)
      expect(applied).toMatchObject({kind: "applied"})
      expect(await f.tool("apply_changes", request)).toEqual(applied)
      const current = await f.native.read(f.owner, entry.id), reopened = createParagraphHistoryStore(f.url, f.now)
      try {expect(await reopened.read(f.owner, entry.id)).toEqual(current)} finally {await reopened.close()}
      const frozen = await f.tool("export_deck", {deckId: entry.id, savedVersion: current.seq, format: "pptx", requestId: `original-shadow-freeze-${entry.id}`}), claim = await f.native.exports.claim()
      expect(frozen).toMatchObject({operationId:expect.any(String)})
      expect(claim).toMatchObject({id: frozen.operationId, snapshotVersion: 3})
      if (!claim || claim.snapshotVersion !== 3) throw new Error("native-shadow-freeze-required")
      const saved = await importPptx(await writeNativeSavedPptx(claim.snapshot.deck, claim.snapshot.seq, bytes, {})), target = flatten(importedNativeDeck(saved).slides.find(slide => slide.source.kind === "original" && slide.source.part === part)!.elements).find(element => element.id === text.id)
      expect(target).toMatchObject({kind: "text", body: {paragraphs: expect.arrayContaining([expect.objectContaining({runs: value.runs})])}})
      expect(await f.tool("undo_change", {deckId: entry.id, base: current.seq, requestId: "original-shadow-undo", changeId: applied.changeId})).toMatchObject({kind: "applied"})
      const undone = await f.native.read(f.owner, entry.id)
      expect(nativeNodes(undone.deck).find(node => node.id === paragraph.id)?.fields.runs).toEqual(paragraph.runs)
      expect(claim.snapshot.deck).toEqual(current.deck)
    }
  } finally {await f.close()}
}, 180000)
