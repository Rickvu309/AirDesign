import { describe, it, expect } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { createHistoryStore } from "../src/db/history-store.ts"
import { commandId, initialHistory, type Command, type History } from "../../../packages/change-log/src/index.ts"
import { SyncClient, parseSnapshot } from "../../../packages/rpc/src/client.ts"
import type { Outbox } from "../../../packages/rpc/src/outbox.ts"
import { id } from "../../../packages/deck/src/index.ts"
import { fixtureDeck, fixtureElement } from "../../../packages/deck/src/fixture.ts"
const owner = { personId: "owner" }, stranger = { personId: "stranger" }
const cid = commandId
function edit(request: string, history: History, text: string): Extract<Command, { kind: "edit" }> {
  const slide = history.deck.slides[0]
  if (!slide) throw new Error("fixture-slide")
  return { id: cid(request), kind: "edit", base: history.seq, run: null, changes: { changes: [{ kind: "set", target: slide.id, value: { ...slide, notes: text } }] } }
}
describe("transactional history adapter", () => {
  it("serializes parallel database delivery, immutable retries and restart on disk", async () => {
    const folder = await mkdtemp(path.join(os.homedir(),"tmp/p04-history-"))
    let store = await createHistoryStore({kind:"pglite",path:folder})
    try {
      const deck = fixtureDeck(2)
      await store.create(owner,deck)
      const command = edit("once",initialHistory(deck),"durable")
      const receipts = await Promise.all([store.commit(owner,deck.id,command),store.commit(owner,deck.id,command)])
      expect(receipts[0]).toEqual(receipts[1])
      expect((await store.replay(owner,deck.id,0)).events).toHaveLength(1)
      await expect(store.commit(owner,deck.id,{...command,base:999})).rejects.toThrow("request-id-payload-mismatch")
      for (const call of [()=>store.read(stranger,deck.id),()=>store.commit(stranger,deck.id,command),()=>store.replay(stranger,deck.id,0),()=>store.delete(stranger,deck.id)]) await expect(call()).rejects.toThrow("deck-not-found")
      await store.close()
      store = await createHistoryStore({kind:"pglite",path:folder})
      expect(await store.commit(owner,deck.id,command)).toEqual(receipts[0])
      expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("durable")
      const undone = await Promise.all([store.commit(owner,deck.id,{id:cid("undo1"),kind:"undo",target:command.id}),store.commit(owner,deck.id,{id:cid("undo2"),kind:"undo",target:command.id})])
      expect(undone.map(r=>r.kind).sort()).toEqual(["applied","refused"])
    } finally { await store.close(); await rm(folder,{recursive:true,force:true}) }
  })
})

it("refuses payload-selected authority and binds run credentials to their owner and deck",async()=>{
 const store=await createHistoryStore({kind:"pglite"})
 try {
  const deck=fixtureDeck(2)
  await store.create(owner,deck)
  await store.commit(owner,deck.id,{id:cid("start_auth"),kind:"start-run",run:"owned"})
  const command:Command={id:cid("agent_auth"),kind:"patch",run:"owned",base:1,target:deck.slides[0]!.id,fields:{notes:"agent"}}
  expect(await store.commit(owner,deck.id,command)).toMatchObject({kind:"refused",code:"execution-identity-mismatch"})
  const token=await store.issueRunToken(owner,deck.id,"owned")
  const actor=await store.runIdentity(owner,deck.id,token)
  expect(await store.commit(owner,deck.id,{...command,id:cid("null_run"),run:null},actor)).toMatchObject({kind:"refused",code:"execution-identity-mismatch"})
  expect(await store.commit(owner,deck.id,{...command,id:cid("other_run"),run:"other"},actor)).toMatchObject({kind:"refused",code:"execution-identity-mismatch"})
  await expect(store.runIdentity(stranger,deck.id,token)).rejects.toThrow("deck-not-found")
  await store.create(owner,{...deck,id:id("otherdeck")})
  await expect(store.runIdentity(owner,"otherdeck",token)).rejects.toThrow("invalid-run-credential")
  expect(await store.commit(owner,deck.id,{...command,id:cid("bound_run")},actor)).toMatchObject({kind:"applied"})
 }finally{await store.close()}
})

it("retains a nested adopted child and minimal ancestors after database restart",async()=>{
 const folder=await mkdtemp(path.join(os.homedir(),"tmp/p04-nested-"))
 let store=await createHistoryStore({kind:"pglite",path:folder})
 const deck=fixtureDeck(2),slide=deck.slides[0]
 if(!slide)throw new Error("fixture-slide")
 try{
  await store.create(owner,deck)
  await store.commit(owner,deck.id,{id:cid("nested_start"),kind:"start-run",run:"nested"})
  const actor={kind:"run" as const,run:"nested"}
  const child={...fixtureElement(1),id:id("kept_child")}
  const inner={...fixtureElement(1),id:id("inner"),kind:"group" as const,children:[child,{...fixtureElement(1),id:id("lost_child")}]}
  const outer={...fixtureElement(1),id:id("outer"),kind:"group" as const,children:[inner,{...fixtureElement(1),id:id("lost_sibling")}]}
  expect(await store.commit(owner,deck.id,{id:cid("nested_create"),kind:"edit",run:"nested",base:1,changes:{changes:[{kind:"insert",parent:deck.id,index:1,value:{...slide,id:id("kept_slide"),elements:[outer]}}]}},actor)).toMatchObject({kind:"applied"})
  await store.commit(owner,deck.id,{id:cid("nested_touch"),kind:"patch",run:null,base:2,target:child.id,fields:{fill:"#ff0000"}})
  await store.close()
  store=await createHistoryStore({kind:"pglite",path:folder})
  expect(await store.commit(owner,deck.id,{id:cid("nested_undo"),kind:"undo-run",run:"nested"})).toMatchObject({kind:"applied"})
  const kept=(await store.read(owner,deck.id)).deck.slides.find(item=>item.id==="kept_slide")
  expect(kept?.elements).toHaveLength(1)
  const group=kept?.elements[0]
  if(group?.kind!=="group")throw new Error("missing-outer")
  expect(group.children).toHaveLength(1)
  const nested=group.children[0]
  if(nested?.kind!=="group")throw new Error("missing-inner")
  expect(nested.children).toEqual([{...child,fill:"#ff0000"}])
  await store.close()
  store=await createHistoryStore({kind:"pglite",path:folder})
  expect((await store.read(owner,deck.id)).deck.slides.find(item=>item.id==="kept_slide")).toEqual(kept)
 }finally{await store.close();await rm(folder,{recursive:true,force:true})}
})

it("returns authoritative contribution history for offline undo after restart",async()=>{
  const folder=await mkdtemp(path.join(os.homedir(),"tmp/p05-offline-history-"))
  let store=await createHistoryStore({kind:"pglite",path:folder})
  try {
    const deck=fixtureDeck(2)
    await store.create(owner,deck)
    const command=edit("saved_before_close",initialHistory(deck),"saved edit")
    expect(await store.commit(owner,deck.id,command)).toMatchObject({kind:"applied"})
    await store.close()
    store=await createHistoryStore({kind:"pglite",path:folder})
    const snapshot=parseSnapshot(JSON.parse(JSON.stringify(await store.read(owner,deck.id))))
    expect(snapshot.contributions?.applied).toContain(command.id)
    expect(snapshot.contributions?.history.events).toMatchObject([{id:command.id,actor:"person",active:true}])
    const outbox:Outbox={read:async()=>[],write:async()=>{}}
    const client=new SyncClient("owner",snapshot,outbox,()=>{})
    await client.enqueue({id:cid("offline_undo"),kind:"undo",target:command.id})
    expect(client.deck.slides[0]?.notes).toBe(deck.slides[0]?.notes)
    await expect(store.read(stranger,deck.id)).rejects.toThrow("deck-not-found")
  }finally {await store.close();await rm(folder,{recursive:true,force:true})}
})

it("sends only changed contributions while preserving local undo across sync deltas",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),deck=fixtureDeck(1)
  try{
    await store.create(owner,deck)
    await store.commit(owner,deck.id,edit("first",initialHistory(deck),"first"))
    const previous=await store.read(owner,deck.id)
    await store.commit(owner,deck.id,{id:cid("second"),kind:"patch",base:1,run:null,target:deck.slides[0]!.id,fields:{notes:"second"}})
    const delta=await store.delta(owner,deck.id,1)
    expect(delta.contributions.history.events.map(event=>event.id)).toEqual(["second"])
    const merged=parseSnapshot(delta,previous)
    expect(merged.contributions?.history.events).toHaveLength(2)
    await store.commit(owner,deck.id,{id:cid("undo-second"),kind:"undo",target:cid("second")})
    const undone=await store.delta(owner,deck.id,2)
    expect(undone.contributions.history.events).toMatchObject([{id:"second",active:false,toggledAt:3}])
    expect(parseSnapshot(undone,merged).deck.slides[0]?.notes).toBe("first")
    await expect(store.delta(stranger,deck.id,2)).rejects.toThrow("deck-not-found")
  }finally{await store.close()}
})

it("returns committed incremental checkpoints that preserve undo and durable replay",async()=>{
 const store=await createHistoryStore({kind:"pglite"})
 try{
  const deck=fixtureDeck(1)
  await store.create(owner,deck)
  const first:Command={id:cid("checkpoint_first"),kind:"patch",base:0,run:null,target:deck.slides[0]!.id,fields:{notes:"first"}}
  const second:Command={...first,id:cid("checkpoint_second"),base:1,fields:{notes:"second"}}
  await store.commit(owner,deck.id,first)
  const committed=await store.commitSnapshot(owner,deck.id,second,{kind:"person"},1)
  expect(committed.receipt).toMatchObject({kind:"applied",seq:2})
  expect(committed.snapshot.contributions.history.events.map(event=>event.seq)).toEqual([2])
  expect(committed.snapshot.deck.slides[0]?.notes).toBe("second")
  expect(committed.snapshot.contributions.applied).toContain(second.id)
  expect((await store.replay(owner,deck.id,1)).events.map(event=>event.receipt)).toEqual([committed.receipt])
  expect((await store.commitSnapshot(owner,deck.id,second,{kind:"person"},2)).receipt).toEqual(committed.receipt)
  const undone=await store.commitSnapshot(owner,deck.id,{id:cid("checkpoint_undo"),kind:"undo",target:second.id},{kind:"person"},2)
  expect(undone.snapshot.deck.slides[0]?.notes).toBe("first")
  expect(undone.snapshot.contributions.history.events.map(event=>event.seq)).toEqual([2])
  const full=await store.commitSnapshot(owner,deck.id,first,{kind:"person"},null)
  expect(full.snapshot.contributions.history.events.map(event=>event.seq)).toEqual([1,2])
  await expect(store.commitSnapshot(stranger,deck.id,second,{kind:"person"},2)).rejects.toThrow("deck-not-found")
 }finally{await store.close()}
})

it("commits an ordered reconnect batch with immutable receipts, rollback and durable replay",async()=>{
 const folder=await mkdtemp(path.join(os.homedir(),"tmp/p09-batch-"))
 let store=await createHistoryStore({kind:"pglite",path:folder})
 try{
  const deck=fixtureDeck(2),person={kind:"person" as const}
  await store.create(owner,deck)
  const commands:Extract<Command,{kind:"patch"}>[]=Array.from({length:100},(_,index)=>({id:cid(`batch_${index}`),kind:"patch",base:0,run:null,target:id("s0"),fields:{notes:`batch ${index}`}}))
  const batch=await store.commitBatchSnapshot(owner,deck.id,commands,person,0)
  expect(batch.receipts.map(receipt=>receipt.seq)).toEqual(Array.from({length:100},(_,index)=>index+1))
  expect(batch.receipts.every(receipt=>receipt.kind==="applied")).toBe(true)
  expect(batch.snapshot.deck.slides[0]?.notes).toBe("batch 99")
  expect(batch.snapshot.contributions.applied).toHaveLength(100)
  expect((await store.commitBatchSnapshot(owner,deck.id,commands,person,0)).receipts).toEqual(batch.receipts)
  const first=commands[0]!
  const fresh:Command={id:cid("rolled_back"),kind:"patch",base:100,run:null,target:id("s0"),fields:{notes:"must roll back"}}
  await expect(store.commitBatchSnapshot(owner,deck.id,[fresh,{...first,base:999}],person,100)).rejects.toThrow("request-id-payload-mismatch")
  expect((await store.read(owner,deck.id)).seq).toBe(100)
  await expect(store.commitBatchSnapshot(stranger,deck.id,commands,person,0)).rejects.toThrow("deck-not-found")
  await store.close();store=await createHistoryStore({kind:"pglite",path:folder})
  expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("batch 99")
  expect((await store.replay(owner,deck.id,0)).events).toHaveLength(100)
  expect((await store.commit(owner,deck.id,{id:cid("batch_undo"),kind:"undo",target:commands[99]!.id})).kind).toBe("applied")
  expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("batch 98")
 }finally{await store.close();await rm(folder,{recursive:true,force:true})}
})
