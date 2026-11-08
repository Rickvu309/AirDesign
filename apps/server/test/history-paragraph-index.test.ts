import {PGlite} from "@electric-sql/pglite"
import {expect,it} from "vitest"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {id} from "../../../packages/deck/src/model.ts"
import {commandId, type Command, type ExecutionIdentity} from "../../../packages/change-log/src/index.ts"
import {transduceLegacyHistory, type ArchivedEventV2, type ArchivedReceiptV2} from "../../../packages/change-log/src/text/history-transducer.ts"
import {rebuildHistoryHeads} from "../../../packages/change-log/src/text/history-heads.ts"
import {executeNative} from "../../../packages/change-log/src/text/native-model.ts"
import {currentProjection,loadHistoryIndex,rebuildHistoryIndex} from "../src/db/history-index.ts"
import {createHistoryStore} from "../src/db/history-store.ts"

it("transduces the actual legacy store and retains adoption through the production index",async()=>{
  const client=new PGlite(), store=await createHistoryStore({kind:"pglite",client}), owner={personId:"paragraph-owner"}, deck=fixtureDeck(2)
  try {
    await store.create(owner,deck)
    const identities=new Map<string,ExecutionIdentity>()
    async function send(command:Command,identity:ExecutionIdentity={kind:"person"}) {
      identities.set(command.id,identity)
      expect(await store.commit(owner,deck.id,command,identity)).toMatchObject({kind:"applied"})
    }
    await send({id:commandId("start"),kind:"start-run",run:"agent"})
    await send({id:commandId("agent"),kind:"patch",base:1,run:"agent",target:id("s0e0"),fields:{runs:[{text:"agent\n",font:"Arial",size:20,bold:false,color:"#000000"}]}},{kind:"run",run:"agent"})
    await send({id:commandId("adopt"),kind:"patch",base:2,run:null,target:id("s0e0"),fields:{box:{x:1,y:2,width:300,height:80}}})
    await send({id:commandId("undo-agent"),kind:"undo",target:commandId("agent")})
    await send({id:commandId("redo-agent"),kind:"redo",target:commandId("agent")})
    const history=(await store.read(owner,deck.id)).contributions.history
    const events=await client.query<{seq:number;commandBytes:string;receiptBytes:string;request:string}>("SELECT seq,command::text AS \"commandBytes\",receipt::text AS \"receiptBytes\",command->>'id' AS request FROM editing_event WHERE deck=$1 ORDER BY seq",[deck.id])
    const receipts=await client.query<ArchivedReceiptV2>("SELECT id,payload,receipt::text AS \"receiptBytes\" FROM editing_receipt WHERE deck=$1",[deck.id])
    const immutableEvents:ArchivedEventV2[]=events.rows.map(row=>{
      const identity=identities.get(row.request)
      if(!identity)throw new Error("fixture-identity")
      return {seq:row.seq,commandBytes:row.commandBytes,receiptBytes:row.receiptBytes,identity}
    })
    const legacyProperties=(await client.query("SELECT node,key,event,seq,active,payload->>'actor' AS actor FROM editing_property WHERE deck=$1",[deck.id])).rows
    const legacyKeys=(await client.query("SELECT node,key,latest->>'id' AS latest,person->>'id' AS person FROM editing_key WHERE deck=$1",[deck.id])).rows
    const converted=transduceLegacyHistory({version:2,history,immutable:{version:2,events:immutableEvents,receipts:receipts.rows}})
    await client.transaction(tx=>rebuildHistoryIndex(tx,deck.id,converted.history))
    const heads=rebuildHistoryHeads(converted.history)
    const properties=await client.query("SELECT node,key,event,seq,active,payload->>'actor' AS actor FROM editing_property WHERE deck=$1",[deck.id])
    const keys=await client.query("SELECT node,key,latest->>'id' AS latest,person->>'id' AS person FROM editing_key WHERE deck=$1",[deck.id])
    const sorted=(rows:unknown[])=>rows.map(row=>JSON.stringify(row,Object.keys(Object(row)).sort())).sort()
    expect(sorted(legacyProperties)).toEqual(sorted(rebuildHistoryHeads(history).properties))
    expect(sorted(legacyKeys)).toEqual(sorted(rebuildHistoryHeads(history).keys))
    expect(sorted(properties.rows)).toEqual(sorted(heads.properties))
    expect(sorted(keys.rows)).toEqual(sorted(heads.keys))
    const text=converted.history.deck.slides[0]?.elements[0]
    if(text?.kind!=="text")throw new Error("fixture-text")
    const command={id:commandId("old-run-frame"),kind:"patch",base:5,run:"agent",target:text.body.frame.id,fields:{anchor:"middle"}} satisfies Command
    const reduced=currentProjection(converted.history)
    await loadHistoryIndex(client,deck.id,reduced,command)
    expect(reduced.events.find(event=>event.id==="adopt")?.patches.some(patch=>patch.id===text.body.frame.id && patch.adopts)).toBe(true)
    expect(executeNative(reduced,command,{kind:"run",run:"agent"}).receipt).toMatchObject({kind:"refused",code:"person-protected"})
    const undo={id:commandId("native-undo"),kind:"undo-run",run:"agent"} satisfies Command
    const undoInput=currentProjection(converted.history)
    await loadHistoryIndex(client,deck.id,undoInput,undo)
    const undone=executeNative(undoInput,undo)
    expect(undone.receipt).toMatchObject({kind:"applied"})
    const kept=undone.history.deck.slides[0]?.elements[0]
    expect(kept).toMatchObject({kind:"text",box:{x:1,y:2}})
    expect((await client.query<ArchivedReceiptV2>("SELECT id,payload,receipt::text AS \"receiptBytes\" FROM editing_receipt WHERE deck=$1",[deck.id])).rows).toEqual(receipts.rows)
    expect((await client.query("SELECT command::text AS command,receipt::text AS receipt FROM editing_event WHERE deck=$1 ORDER BY seq",[deck.id])).rows).toEqual(events.rows.map(row=>({command:row.commandBytes,receipt:row.receiptBytes})))
  } finally { await store.close() }
},30000)
