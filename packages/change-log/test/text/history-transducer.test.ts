import {describe,expect,it} from "vitest"
import {fixtureDeck,fixtureElement} from "../../../deck/src/fixture.ts"
import {id, type Element} from "../../../deck/src/model.ts"
import {parseDeck} from "../../../deck/src/parse.ts"
import {commandId,projectHistory} from "../../src/index.ts"
import {transduceLegacyHistory,archivedLegacyRetry} from "../../src/text/history-transducer.ts"
import {nativeHistoryModel,executeNative} from "../../src/text/native-model.ts"
import {allocateTextLifetimeIds} from "../../src/text/migration-ids.ts"
import {legacyTape} from "./history-fixture.ts"

function firstText() { const text=fixtureElement(0);if(text.kind!=="text")throw new Error("fixture-text");return text }
describe("complete versioned legacy history transduction",()=>{
  it("treats persisted property keys as a set after JSONB reorders object fields",()=>{
    const tape=legacyTape(fixtureDeck(2))
    tape.patch("properties",id("s0e0"),{box:{x:1,y:2,width:300,height:90},runs:[{...firstText().runs[0],text:"changed"}]})
    const expected=transduceLegacyHistory(tape.archive)
    for(const event of tape.archive.history.events) for(const patch of event.patches) patch.keys.reverse()
    expect(transduceLegacyHistory(tape.archive)).toEqual(expected)
    const patch=tape.archive.history.events[0]?.patches[0]
    if(!patch)throw new Error("fixture-patch")
    patch.keys.push("fabricated")
    expect(()=>transduceLegacyHistory(tape.archive)).toThrow("legacy-persisted-history-mismatch")
    patch.keys=["box","box"]
    expect(()=>transduceLegacyHistory(tape.archive)).toThrow("duplicate-history-property")
  })
  it("preserves immutable bytes, inactive contributions, adoption, runs and later person edits",()=>{
    const tape=legacyTape(fixtureDeck(2,2)), target=id("s0e0"), original=firstText().runs[0]
    expect(tape.send({id:commandId("start"),kind:"start-run",run:"agent"}).kind).toBe("applied")
    tape.patch("agent",target,{runs:[{...original,text:"agent\n\n",italic:true},{...original,text:"",size:19}]},"agent")
    tape.patch("person",target,{box:{x:10,y:20,width:400,height:90}})
    tape.send({id:commandId("close"),kind:"close-run",run:"agent"})
    tape.send({id:commandId("undo-run"),kind:"undo-run",run:"agent"})
    tape.patch("refused",target,{runs:[{...original,text:"late"}]},"agent")
    const before=structuredClone(tape.archive), converted=transduceLegacyHistory(tape.archive)
    expect(tape.archive).toEqual(before)
    expect(converted.immutable).toEqual(before.immutable)
    expect(converted.history.events.map(({patches:_patches,...metadata})=>metadata)).toEqual(before.history.events.map(({patches:_patches,...metadata})=>metadata))
    expect(converted.history.runs).toEqual(before.history.runs)
    expect(converted.prefixes.map(prefix=>prefix.seq)).toEqual([0,1,2,3,4,5])
    expect(converted.history.events[0]?.active).toBe(false)
    expect(transduceLegacyHistory(converted)).toEqual(converted)
    const missing=structuredClone(before);missing.immutable.receipts.shift()
    expect(()=>transduceLegacyHistory(missing)).toThrow("invalid-archived-event")
    const duplicated=structuredClone(before), receipt=duplicated.immutable.receipts[0]
    if(!receipt)throw new Error("fixture-receipt")
    duplicated.immutable.receipts.push(receipt)
    expect(()=>transduceLegacyHistory(duplicated)).toThrow("invalid-archived-receipt")
    expect(()=>parseDeck(converted.history.deck)).toThrow()
    const element=converted.history.deck.slides[0]?.elements[0]
    if(element?.kind!=="text")throw new Error("converted-text")
    expect(element.body.paragraphs).toHaveLength(1)
    expect(element.body.paragraphs[0].runs).toEqual([{kind:"text",text:original.text,style:{font:original.font,size:original.size,color:original.color,bold:original.bold}}])
    expect(archivedLegacyRetry(converted,commandId("start"),"identity-bound-start")).toEqual({kind:"hit",receiptBytes:before.immutable.receipts[0]?.receiptBytes})
    expect(archivedLegacyRetry(converted,commandId("refused"),"identity-bound-refused")).toEqual({kind:"hit",receiptBytes:before.immutable.receipts.at(-1)?.receiptBytes})
    expect(()=>archivedLegacyRetry(converted,commandId("refused"),"different-identity")).toThrow("request-id-payload-mismatch")
    expect(executeNative(converted.history,{id:commandId("later-start"),kind:"start-run",run:"later"}).receipt.kind).toBe("applied")
    const later=executeNative(converted.history,{id:commandId("later-person"),kind:"patch",target:element.body.paragraphs[0].id,base:converted.history.seq,run:null,fields:{alignment:"right"}})
    expect(later.receipt.kind).toBe("applied")
    expect(projectHistory(later.history,nativeHistoryModel)).toEqual(later.history.deck)
  })
  it("tracks kind closure, reopen and deletion resurrection as separate stable lifetimes",()=>{
    const tape=legacyTape(fixtureDeck(2)), target=id("s0e1"), text={...firstText(),id:target}
    function replace(name:string,value:Element){const deck=structuredClone(tape.archive.history.deck);if(!deck.slides[0])throw new Error("fixture-slide");deck.slides[0].elements[1]=value;expect(tape.send({id:commandId(name),kind:"edit",base:tape.archive.history.seq,run:null,changes:{changes:[{kind:"set",target:deck.id,value:deck}]}}).kind).toBe("applied")}
    replace("open",text)
    replace("close",{...fixtureElement(1),id:target})
    tape.send({id:commandId("undo-close"),kind:"undo",target:commandId("close")})
    const resurrected=transduceLegacyHistory(tape.archive), first=resurrected.lifetimes.find(value=>value.element===target)
    expect(first).toBeDefined()
    tape.send({id:commandId("redo-close"),kind:"redo",target:commandId("close")})
    replace("reopen",{...text,runs:[{...text.runs[0],text:"new lifetime"}]})
    tape.send({id:commandId("delete"),kind:"edit",base:tape.archive.history.seq,run:null,changes:{changes:[{kind:"remove",target}]}})
    tape.send({id:commandId("undo-delete"),kind:"undo",target:commandId("delete")})
    const converted=transduceLegacyHistory(tape.archive), allocations=converted.lifetimes.filter(value=>value.element===target)
    expect(allocations).toHaveLength(2)
    expect(allocations.find(value=>value.lifetime.kind==="contribution" && value.lifetime.command==="open")).toEqual(first)
    const current=converted.history.deck.slides[0]?.elements[1]
    if(current?.kind!=="text")throw new Error("reopened-text")
    expect(current.body.frame.id).toBe(allocations.find(value=>value.lifetime.kind==="contribution" && value.lifetime.command==="reopen")?.frame)
    expect(converted.history.usedIds).toEqual(expect.arrayContaining(allocations.flatMap(value=>[value.frame,value.paragraph])))
    expect(projectHistory(converted.history,nativeHistoryModel)).toEqual(converted.history.deck)
  })
  it("retains nested adopted text and inherited trailing empty style after run undo",()=>{
    const tape=legacyTape(fixtureDeck(1)), text={...firstText(),id:id("nested"),runs:[{...firstText().runs[0],text:"a\n\n"},{...firstText().runs[0],text:"",italic:true,size:17}] satisfies [import("../../../deck/src/model.ts").Run,...import("../../../deck/src/model.ts").Run[]]}
    tape.send({id:commandId("start"),kind:"start-run",run:"agent"})
    const {kind:discarded,runs,...base}=firstText();void discarded;void runs
    tape.send({id:commandId("insert"),kind:"edit",base:tape.archive.history.seq,run:"agent",changes:{changes:[{kind:"insert",parent:id("s0"),index:1,value:{...base,id:id("outer"),kind:"group",children:[{...base,id:id("inner"),kind:"group",children:[text]}]}}]}})
    tape.patch("adopt",text.id,{box:{x:1,y:2,width:300,height:80}})
    tape.send({id:commandId("undo"),kind:"undo-run",run:"agent"})
    const converted=transduceLegacyHistory(tape.archive), outer=converted.history.deck.slides[0]?.elements[1]
    if(outer?.kind!=="group" || outer.children[0]?.kind!=="group" || outer.children[0].children[0]?.kind!=="text")throw new Error("nested-text")
    const paragraph=outer.children[0].children[0].body.paragraphs[0]
    expect(paragraph.endStyle).toMatchObject({italic:true,size:17})
    expect(paragraph.runs.map(run=>run.kind)).toEqual(["text","break","break"])
    expect(converted.history.events.find(event=>event.id==="adopt")?.patches.filter(patch=>patch.adopts)).toHaveLength(3)
  })
  it("reserves historical collisions and refuses missing or corrupt persisted state",()=>{
    const tape=legacyTape(fixtureDeck(1)), initial={deck:tape.archive.history.deck.id,element:id("s0e0"),lifetime:{kind:"initial"} as const}, collision=allocateTextLifetimeIds([initial],tape.archive.history.usedIds)[0]
    if(!collision)throw new Error("allocation")
    tape.archive.history.usedIds.push(collision.frame,collision.paragraph,id("historical"))
    const converted=transduceLegacyHistory(tape.archive)
    expect(converted.lifetimes[0]?.frame).not.toBe(collision.frame)
    expect(converted.history.usedIds).toEqual(expect.arrayContaining([collision.frame,collision.paragraph,"historical"]))
    const broken=structuredClone(tape.archive);broken.history.seq++
    expect(()=>transduceLegacyHistory(broken)).toThrow("legacy-persisted-history-mismatch")
    const tampered=structuredClone(converted);tampered.history.events.push({id:commandId("bad"),seq:1,actor:"person",run:null,active:false,toggledAt:1,patches:[{id:id("ghost"),before:null,after:{id:id("ghost"),parent:id("s0"),order:0,fields:{kind:"text",runs:[]}},keys:["existence"],adopts:true,places:false}]})
    expect(()=>transduceLegacyHistory(tampered)).toThrow("invalid-native-history-node")
  })
})
