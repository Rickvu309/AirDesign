import {expect,it} from "vitest"
import pg from "pg"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdir,readFile,writeFile} from "node:fs/promises"
import path from "node:path"
import {mcpFixture,toolValue} from "./mcp/fixture.ts"
import {createParagraphHistoryStore} from "../src/db/paragraph-history-store.ts"
import {prepareParagraphCutover,pauseParagraphEditing} from "../src/db/paragraph-protocol.ts"
import {cutoverParagraphHistory} from "../src/db/paragraph-cutover.ts"
import {decodeLegacyCatalogDeckV2} from "../../../packages/catalog/src/text/seed.ts"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {id} from "../../../packages/deck/src/index.ts"
import {purgeExpiredDecks} from "../../worker/src/purge/expired-decks.ts"
import {nativeNodes} from "../../../packages/change-log/src/text/native-model.ts"
import {importPptx} from "../../../packages/pptx/src/index.ts"
import {importedNativeDeck} from "../../../packages/pptx/src/import-deck.ts"
import {writeNativeSavedPptx} from "../../../packages/pptx/src/export-deck.ts"
import {OperationStore,operationId} from "../../../packages/operations/src/index.ts"

const cutover={pause:{kind:"paused",drafts:"retained-or-visibly-refused",oldReaders:"retired"},lockBudgetMs:1000,conversionBudgetMs:30000} satisfies Parameters<typeof cutoverParagraphHistory>[1]

it("shares catalog lifecycle over real native PostgreSQL, HTTP and hosted tools without rewriting retained inputs",async()=>{
  const fixture=await mcpFixture(),sql=new pg.Client({connectionString:fixture.url})
  const native=createParagraphHistoryStore(fixture.url,fixture.now),operations=new OperationStore(fixture.operationsPath,fixture.now)
  await sql.connect()
  try{
    const owner=await fixture.signIn("native-catalog@example.com"),stranger=await fixture.signIn("foreign-catalog@example.com"),authorized=await fixture.authorize(owner.cookie)
    const legacy=fixtureDeck(2),nested=legacy.slides[0]?.elements[0]
    if(!nested || !legacy.slides[0])throw new Error("nested-fixture-required")
    legacy.slides[0].elements=[{id:id("catalogGroup"),kind:"group",box:nested.box,source:nested.source,support:nested.support,theme:null,placeholder:null,overlap:null,children:[nested]}]
    const retained=await fixture.history.catalog.create(owner,"retained","Retained","draft",legacy)
    const saved=(await sql.query("SELECT input::text FROM catalog_request WHERE request='retained'")).rows
    async function call(route:string,method="GET",body?:unknown,cookie=owner.cookie,protocol="paragraph-body-v3"){
      return fetch(fixture.apiOrigin+route,{method,headers:{origin:fixture.origin,cookie,"content-type":"application/json","x-text-protocol":protocol},body:body===undefined ? undefined : JSON.stringify(body)})
    }
    async function tool(name:string,args:Record<string,unknown>={}){
      const response=await fetch(fixture.apiOrigin+"/mcp",{method:"POST",headers:{authorization:`Bearer ${authorized.tokens.access_token}`,"content-type":"application/json",accept:"application/json, text/event-stream","mcp-protocol-version":"2025-11-25","x-text-protocol":"paragraph-body-v3"},body:JSON.stringify({jsonrpc:"2.0",id:name,method:"tools/call",params:{name,arguments:args}})})
      const result=await response.json()
      if(!response.ok)return result
      return toolValue(result.result)
    }
    const legacyInput=await readFile("fixtures/pptx/native.pptx"),legacyOperation=operations.submit(owner,"old-import-inflight",legacyInput),legacyClaim=operations.claim(legacyOperation.id)
    if(!legacyClaim)throw new Error("legacy-import-lease-required")
    const legacyJob=path.join(fixture.directory,"legacy-job")
    await mkdir(legacyJob)
    await writeFile(path.join(legacyJob,"input.pptx"),legacyInput)
    await promisify(execFile)(process.execPath,["apps/worker/src/import.ts"],{env:{...process.env,AIRDESIGN_JOB_DIRECTORY:legacyJob},maxBuffer:65536})
    const legacyReport=JSON.parse(await readFile(path.join(legacyJob,"report.json"),"utf8")),legacyBytes=await readFile(path.join(legacyJob,"result.pptx"))
    expect(legacyReport.deckVersion).toBe(2)
    await prepareParagraphCutover(sql)
    await pauseParagraphEditing(sql,true)
    const draft={requestId:"new",title:"Native",pendingRequest:"Keep this input",starter:"welcome"}
    expect(await (await call("/api/catalog","POST",draft)).json()).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect(await tool("create_deck",{requestId:"paused-tool",title:"Keep tool input"})).toMatchObject({code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect((await sql.query("SELECT request FROM catalog_request WHERE request='new'")).rows).toEqual([])
    await cutoverParagraphHistory(sql,cutover)
    await pauseParagraphEditing(sql,false)
    expect((await call("/api/catalog","POST",draft,owner.cookie,"legacy-text-v2")).status).toBe(409)
    await expect(fixture.history.catalog.create(owner,"old-fenced","Old")).rejects.toThrow("editing-protocol-mismatch")
    expect(await native.catalog.create(owner,"retained","Retained","draft",decodeLegacyCatalogDeckV2(legacy))).toMatchObject({id:retained.id})
    expect((await sql.query("SELECT input::text FROM catalog_request WHERE request='retained'")).rows).toEqual(saved)
    const created=await call("/api/catalog","POST",draft)
    expect(created.status).toBe(201)
    const entry=await created.json()
    expect(await (await call("/api/catalog","POST",draft)).json()).toEqual(entry)
    expect((await call("/api/catalog","POST",{...draft,title:"Changed"})).status).toBe(400)
    expect((await call(`/api/catalog/${entry.id}`,"GET",undefined,stranger.cookie)).status).toBe(404)
    const initial=await native.read(owner,entry.id)
    expect(initial.events).toEqual([])
    expect(initial.usedIds).toEqual(nativeNodes(initial.deck).map(node=>node.id))
    const text=initial.deck.slides[0]?.elements.find(element=>element.kind==="text")
    if(text?.kind!=="text")throw new Error("welcome-native-text-required")
    const command={version:3,command:{id:"paragraph",kind:"patch",base:0,run:null,target:text.body.paragraphs[0].id,fields:{alignment:"right"}}}
    expect(await (await call(`/api/decks/${entry.id}/commands`,"POST",command)).json()).toMatchObject({kind:"applied",seq:1})
    const duplicate=await (await call(`/api/catalog/${entry.id}/duplicate`,"POST",{requestId:"duplicate"})).json()
    expect(duplicate.id).not.toBe(entry.id)
    const copy=await native.read(owner,duplicate.id)
    expect(copy).toMatchObject({seq:0,events:[],runs:[]})
    expect(copy.deck.slides).toEqual((await native.read(owner,entry.id)).deck.slides)
    expect(copy.usedIds).toEqual(nativeNodes(copy.deck).map(node=>node.id))
    expect(await (await call(`/api/decks/${duplicate.id}/commands`,"POST",{version:3,command:{id:"undo-source",kind:"undo",target:"paragraph"}})).json()).toMatchObject({kind:"refused"})
    expect(await (await call(`/api/decks/${entry.id}/commands`,"POST",{version:3,command:{id:"undo",kind:"undo",target:"paragraph"}})).json()).toMatchObject({kind:"applied",seq:2})
    expect((await native.read(owner,duplicate.id)).deck).toEqual(copy.deck)
    expect((await native.catalog.list(owner,false,"clear direction")).map(item=>item.id)).toContain(retained.id)
    expect(await native.catalog.list(owner,false,"Geist")).toEqual([])
    expect(await tool("create_deck",{requestId:"tool-create",title:"Hosted native"})).toMatchObject({title:"Hosted native"})
    expect((await tool("list_decks")).items.some((item:{id:string})=>item.id===entry.id)).toBe(true)
    expect(await tool("apply_changes",{deckId:entry.id,base:2,requestId:"old-write",changes:[{kind:"set",target:text.id,value:{...nested,runs:[{text:"Must retain this draft",size:24,font:"Geist",color:"#000000",bold:false}]}}]})).toMatchObject({code:"invalid-native-change",retryable:false})

    expect((await native.read(owner,entry.id)).seq).toBe(2)
    const imported=importedNativeDeck(await importPptx(await readFile("fixtures/pptx/native.pptx")))
    const importedText=imported.slides[0]?.elements.find(element=>element.kind==="text")
    if(importedText?.kind!=="text")throw new Error("pptx-text-required")
    importedText.body.frame.anchor="bottom"
    importedText.body.paragraphs.push({...structuredClone(importedText.body.paragraphs[0]),id:id("catalogParagraph"),alignment:"right",marker:{kind:"number",format:"decimal",start:null}})
    const input=await writeNativeSavedPptx(imported,0,null,{},{},{})
    const file=await fixture.history.files.save(owner.personId,"catalog-file","native-import","paragraphs.pptx",async()=>({bytes:input,mime:"application/vnd.openxmlformats-officedocument.presentationml.presentation"}))
    const queued=await tool("import_deck",{fileId:file.fileId,requestId:"native-import"})
    expect(queued).toMatchObject({kind:"queued",operationId:expect.any(String)})
    async function worker(body:unknown,capable=true){return fetch(fixture.apiOrigin+"/internal/worker",{method:"POST",headers:{authorization:"Bearer dev-only-secret-change-me-32chars","content-type":"application/json",...(capable ? {"x-worker-text-protocols":"legacy-text-v2,paragraph-body-v3"} : {})},body:JSON.stringify(body)})}
    expect((await worker({kind:"claim",queue:"import"},false)).status).toBe(409)
    expect(operations.status(owner,operationId(queued.operationId)).kind).toBe("queued")
    await pauseParagraphEditing(sql,true)
    expect(await (await worker({kind:"claim",queue:"import"})).json()).toEqual({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"})
    expect(operations.status(owner,operationId(queued.operationId)).kind).toBe("queued")
    await pauseParagraphEditing(sql,false)
    const claimed=await (await worker({kind:"claim",queue:"import"})).json()
    expect(claimed).toMatchObject({id:queued.operationId,textProtocol:"paragraph-body-v3"})
    const job=path.join(fixture.directory,"native-job")
    await mkdir(job)
    await writeFile(path.join(job,"input.pptx"),Buffer.from(claimed.input,"base64"))
    await writeFile(path.join(job,"text-protocol.json"),JSON.stringify({protocol:claimed.textProtocol}))
    await promisify(execFile)(process.execPath,["apps/worker/src/import.ts"],{env:{...process.env,AIRDESIGN_JOB_DIRECTORY:job},maxBuffer:65536})
    const report=JSON.parse(await readFile(path.join(job,"report.json"),"utf8")),result=await readFile(path.join(job,"result.pptx"))
    expect(report.deckVersion).toBe(3)
    const upload=await fetch(fixture.apiOrigin+`/internal/worker?queue=import&id=${claimed.id}&lease=${claimed.lease}`,{method:"PUT",headers:{authorization:"Bearer dev-only-secret-change-me-32chars"},body:new Uint8Array(result)})
    expect(upload.status).toBe(200)
    expect((await worker({kind:"complete",queue:"import",id:claimed.id,lease:claimed.lease,report})).status).toBe(200)
    const frozen=(await sql.query("SELECT report::text FROM catalog_source ORDER BY deck")).rows
    const importedEntry=await (await call("/api/catalog/import","POST",{operation:claimed.id,requestId:"http-import",title:"Paragraph import"})).json()
    expect(importedEntry.entry?.title).toBe("Paragraph import")
    const body=(await native.read(owner,importedEntry.entry.id)).deck.slides[0]?.elements[0]
    expect(body).toMatchObject({kind:"text",body:{frame:{anchor:"bottom"},paragraphs:[{}, {alignment:"right",marker:{kind:"number",start:null}}]}})
    expect((await tool("get_operation",{operationId:claimed.id})).deck.id).toBeTruthy()
    expect((await native.catalog.original(owner,importedEntry.entry.id))?.report).toEqual(report)
    expect((await native.catalog.original(owner,importedEntry.entry.id))?.bytes).toEqual(result)
    expect(frozen).toEqual([])
    expect(operations.complete(legacyOperation.id,legacyClaim.lease,legacyBytes,legacyReport)).toBe(true)
    const legacyImported=await (await call("/api/catalog/import","POST",{operation:legacyOperation.id,requestId:"legacy-import",title:"Retained old import"})).json()
    expect(legacyImported.entry?.title).toBe("Retained old import")
    expect((await native.read(owner,legacyImported.entry.id)).deck.slides[0]?.elements[0]).toHaveProperty("body")
    expect(await native.catalog.original(owner,legacyImported.entry.id)).toEqual({bytes:legacyBytes,report:legacyReport})
    expect(operations.status(owner,legacyOperation.id)).toMatchObject({kind:"ready",report:legacyReport})
    const importedCopy=await (await call(`/api/catalog/${importedEntry.entry.id}/duplicate`,"POST",{requestId:"import-copy"})).json()
    expect(await native.catalog.original(owner,importedCopy.id)).toEqual(await native.catalog.original(owner,importedEntry.entry.id))

    expect(await (await call(`/api/decks/${entry.id}/commands`,"POST",{version:3,command:{id:"trash-start",kind:"start-run",run:"trash-run"}})).json()).toMatchObject({kind:"applied",seq:3})
    await call(`/api/catalog/${entry.id}/request`,"POST",{pendingRequest:"Retained after reopen"})
    const immutableQuery="SELECT row_to_json(t)::text AS bytes FROM editing_event t WHERE deck=$1 UNION ALL SELECT row_to_json(t)::text AS bytes FROM editing_receipt t WHERE deck=$1 ORDER BY bytes"
    const immutableBefore=(await sql.query(immutableQuery,[entry.id])).rows
    const trashed=await (await call(`/api/catalog/${entry.id}/trash`,"POST",{})).json()
    expect(trashed.generation).toBe(1)
    expect(await (await call(`/api/catalog/${entry.id}/view`)).json()).toMatchObject({seq:3,deleted:true,deck:{id:entry.id}})
    expect((await sql.query("SELECT payload FROM editing_run WHERE deck=$1",[entry.id])).rows).toMatchObject([{payload:{kind:"closed"}}])
    expect((await sql.query("SELECT deck FROM editing_run_credential WHERE deck=$1",[entry.id])).rows).toEqual([])
    await expect(native.read(owner,entry.id)).rejects.toThrow("deck-deleted")
    expect((await call(`/api/catalog/${entry.id}/restore`,"POST",{})).status).toBe(200)
    expect(await (await call("/api/catalog/trash","DELETE",{confirm:"empty-trash",decks:[{id:entry.id,generation:1}]})).json()).toEqual({removed:[]})
    expect((await native.catalog.details(owner,entry.id)).pendingRequest).toBe("Retained after reopen")
    expect((await sql.query(immutableQuery,[entry.id])).rows).toEqual(immutableBefore)
    const reopened=createParagraphHistoryStore(fixture.url,fixture.now)
    try{expect((await reopened.read(owner,duplicate.id)).deck).toEqual(copy.deck)}finally{await reopened.close()}
    await call(`/api/catalog/${entry.id}/trash`,"POST",{})
    expect(await (await call("/api/catalog/trash","DELETE",{confirm:"empty-trash",decks:[{id:entry.id,generation:1}]})).json()).toEqual({removed:[]})
    expect(await (await call("/api/catalog/trash","DELETE",{confirm:"empty-trash",decks:[{id:entry.id,generation:2}]})).json()).toEqual({removed:[entry.id]})
    await call(`/api/catalog/${importedEntry.entry.id}/trash`,"POST",{})
    fixture.advance(30*86400000)
    expect((await call(`/api/catalog/${importedEntry.entry.id}/restore`,"POST",{})).status).toBe(410)
    expect(await purgeExpiredDecks(native.catalog)).toEqual({removed:[importedEntry.entry.id]})
    expect(await purgeExpiredDecks(native.catalog)).toEqual({removed:[]})
    for(const table of ["editing_deck","editing_paragraph","editing_event","editing_receipt","editing_key","editing_property","editing_contribution","editing_run","catalog_request","catalog_source"]){
      const column=table==="editing_deck" ? "id" : "deck"
      expect((await sql.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${column}=$1`,[importedEntry.entry.id])).rows).toEqual([{count:0}])
    }
    expect((await native.read(owner,importedCopy.id)).seq).toBe(0)
  }finally{operations.close();await native.close();await sql.end();await fixture.close()}
},60000)


it("rolls native catalog resource denials back and rejects accounts awaiting or completing deletion",async()=>{
  const fixture=await mcpFixture(),sql=new pg.Client({connectionString:fixture.url}),native=createParagraphHistoryStore(fixture.url,fixture.now)
  await sql.connect()
  try{
    const owner=await fixture.signIn("native-resource@example.com")
    await prepareParagraphCutover(sql)
    await pauseParagraphEditing(sql,true)
    await cutoverParagraphHistory(sql,cutover)
    await pauseParagraphEditing(sql,false)
    const deck=decodeLegacyCatalogDeckV2(fixtureDeck(2)),slide=deck.slides[0],shape=slide?.elements[1]
    if(!slide || !shape)throw new Error("resource-fixture-required")
    slide.elements=[{id:shape.id,kind:"image",box:shape.box,source:shape.source,support:shape.support,theme:null,placeholder:null,overlap:null,image:{asset:"a".repeat(64),crop:{x:0,y:0,width:1,height:1},focal:{x:.5,y:.5},mask:"rectangle",alt:"Denied owned asset"}}]
    await expect(native.catalog.create(owner,"denied-asset","Denied","Retain this input",deck)).rejects.toThrow("asset-not-found")
    expect((await sql.query("SELECT request FROM catalog_request WHERE request='denied-asset'")).rows).toEqual([])
    expect((await sql.query("SELECT id FROM editing_deck WHERE owner=$1",[owner.personId])).rows).toEqual([])
    expect((await sql.query("SELECT deck FROM editing_paragraph")).rows).toEqual([])
    const entry=await native.catalog.create(owner,"account-create","Account pending")
    await native.deletions.enqueue(owner.personId)
    await expect(native.catalog.list(owner)).rejects.toThrow("account-deleting")
    await expect(native.catalog.create(owner,"account-refused","Keep me")).rejects.toThrow("account-deleting")
    await expect(native.catalog.details(owner,entry.id)).rejects.toThrow("account-deleting")
    expect(await native.deletions.purge(owner.personId)).toBe(true)
    await expect(native.catalog.create(owner,"account-refused","Keep me")).rejects.toThrow("account-deleted")
    expect((await sql.query("SELECT request FROM catalog_request WHERE owner=$1",[owner.personId])).rows).toEqual([])
  }finally{await native.close();await sql.end();await fixture.close()}
},60000)
