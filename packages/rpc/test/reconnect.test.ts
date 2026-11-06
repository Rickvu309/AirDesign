import { expect, it, vi } from "vitest"
import { SyncClient, parseSnapshot } from "../src/client.ts"
import { outboxKey, type Outbox, type Pending } from "../src/outbox.ts"
import { commandId, execute, initialHistory, type Command } from "../../change-log/src/index.ts"
import { fixtureDeck, fixtureElement } from "../../deck/src/fixture.ts"
import { id } from "../../deck/src/index.ts"

function patch(name: string, notes=name): Command { return {id:commandId(name),kind:"patch",base:0,run:null,target:id("s0"),fields:{notes}} }
function memory() {
  const storage=new Map<string,Pending[]>()
  const outbox:Outbox={read:async key=>structuredClone(storage.get(key) ?? []),write:async(key,items,removed=[])=>{storage.set(key,[...(storage.get(key) ?? []).filter(item=>!removed.includes(item.command.id) && !items.some(next=>next.command.id===item.command.id)),...structuredClone(items)])}}
  return {storage,outbox}
}
it("paints immediately, persists before sending and never loses typing during an acknowledgement",async()=>{
  const {outbox,storage}=memory()
  let release:()=>void=()=>{}
  const written=new Promise<void>(resolve=>{release=resolve})
  const delayed:Outbox={read:outbox.read,write:async(key,items,removed)=>{await written;await outbox.write(key,items,removed)}}
  const client=new SyncClient("person",{deck:fixtureDeck(2),seq:0},delayed,()=>{})
  const sent:Command[]=[]
  client.connected(command=>{expect(storage.get(client.key)?.some(item=>item.command.id===command.id)).toBe(true);sent.push(command)})
  const first=client.enqueue(patch("first","first"))
  expect(client.deck.slides[0]?.notes).toBe("first")
  expect(sent).toEqual([])
  const ack=client.acknowledge({id:commandId("first"),kind:"applied",seq:1})
  const second=client.enqueue(patch("second","second"))
  release();await Promise.all([first,ack,second])
  expect(client.queue.map(item=>item.command.id)).toEqual(["second"])
  expect(client.deck.slides[0]?.notes).toBe("second")
  expect(storage.get(client.key)?.map(item=>item.command.id)).toEqual(["second"])
  expect(sent.map(command=>command.id)).toEqual(["second"])
})
it("reloads the principal-scoped queue and retries stable ids once per connection",async()=>{
  const {outbox}=memory()
  const snapshot={deck:fixtureDeck(2),seq:0}
  const first=new SyncClient("a",snapshot,outbox,()=>{})
  await Promise.all(Array.from({length:100},(_,i)=>first.enqueue(patch(`queued_${i}`))))
  const reloaded=new SyncClient("a",snapshot,outbox,()=>{}), other=new SyncClient("b",snapshot,outbox,()=>{})
  await reloaded.load();await other.load()
  expect(reloaded.deck.slides[0]?.notes).toBe("queued_99")
  expect(other.queue).toEqual([])
  expect(outboxKey("a","deck")).not.toBe(outboxKey("b","deck"))
  const sent:Command[]=[]
  reloaded.connected(command=>sent.push(command));reloaded.connected(command=>sent.push(command))
  expect(sent).toHaveLength(100)
  reloaded.stop("signed-out");expect(reloaded.resume("b")).toBe(false)
  reloaded.connected(command=>sent.push(command));expect(sent).toHaveLength(100)
  expect(reloaded.resume("a")).toBe(true)
  reloaded.connected(command=>sent.push(command));expect(sent).toHaveLength(200)
  expect(sent.slice(0,100)).toEqual(sent.slice(100))
})
it("rebases queued people over later agent snapshots, preserves restore choices and stops deleted decks",async()=>{
  const {outbox}=memory(), deck=fixtureDeck(2)
  const client=new SyncClient("a",{deck,seq:0},outbox,()=>{})
  await client.enqueue(patch("person","mine"))
  const agent=structuredClone(deck);agent.slides[0]!.notes="agent"
  client.receive({deck:agent,seq:2})
  expect(client.deck.slides[0]?.notes).toBe("mine")
  await client.acknowledge({id:commandId("person"),kind:"refused",seq:2,code:"invalid-reference",command:patch("person","mine"),restore:commandId("delete")})
  expect(client.queue[0]).toMatchObject({kind:"rejected",restore:"delete"})
  const reloaded=new SyncClient("a",{deck:agent,seq:2},outbox,()=>{});await reloaded.load()
  expect(reloaded.queue).toEqual(client.queue)
  await reloaded.recover("person",[{id:commandId("restore"),kind:"undo",target:commandId("delete")},patch("retry","mine")])
  expect(reloaded.queue.map(item=>item.command.id)).toEqual(["restore","retry"])
  reloaded.stop("deleted")
  expect(reloaded.resume("a")).toBe(false)
  await expect(reloaded.enqueue(patch("never"))).rejects.toThrow("deleted")
  expect(reloaded.queue).toHaveLength(2)
})

it("projects offline edit undo redo across reload",async()=>{
  const {outbox}=memory(), snapshot={deck:fixtureDeck(2),seq:0}
  const client=new SyncClient("a",snapshot,outbox,()=>{})
  await client.enqueue(patch("offline","mine"))
  await client.enqueue({id:commandId("undo"),kind:"undo",target:commandId("offline")})
  expect(client.deck.slides[0]?.notes).toBe(snapshot.deck.slides[0]?.notes)
  await client.enqueue({id:commandId("redo"),kind:"redo",target:commandId("offline")})
  const reload=new SyncClient("a",snapshot,outbox,()=>{});await reload.load()
  expect(reload.deck.slides[0]?.notes).toBe("mine")
})

it("preserves used node ids while projecting a mutation-only queue",async()=>{
  const {outbox}=memory(), snapshot={deck:fixtureDeck(2),seq:0}
  const client=new SyncClient("a",snapshot,outbox,()=>{})
  const element={...fixtureElement(1),id:id("queued_child")}
  await client.enqueue({id:commandId("create_child"),kind:"edit",base:0,run:null,changes:{changes:[{kind:"insert",parent:id("s0"),index:0,value:element}]}})
  await client.enqueue({id:commandId("remove_child"),kind:"edit",base:0,run:null,changes:{changes:[{kind:"remove",target:element.id}]}})
  await client.enqueue({id:commandId("reuse_child"),kind:"edit",base:0,run:null,changes:{changes:[{kind:"insert",parent:id("s0"),index:0,value:element}]}})
  expect(client.deck.slides[0]?.elements.some(item=>item.id===element.id)).toBe(false)
  await client.enqueue({id:commandId("undo_removal"),kind:"undo",target:commandId("remove_child")})
  expect(client.deck.slides[0]?.elements.find(item=>item.id===element.id)).toEqual(element)
  const reload=new SyncClient("a",snapshot,outbox,()=>{});await reload.load()
  expect(reload.deck).toEqual(client.deck)
})

it.each([false,true])("projects saved undo and redo with lost acknowledgement=%s",async lost=>{
  const {outbox}=memory(), deck=fixtureDeck(2,2)
  const edit=patch("saved_person","saved person notes")
  let history=execute(initialHistory(deck),edit).history
  history=execute(history,{id:commandId("start_agent"),kind:"start-run",run:"fixture_run"}).history
  history=execute(history,{id:commandId("agent_other"),kind:"patch",base:history.seq,run:"fixture_run",target:id("s1"),fields:{notes:"agent notes"}},{kind:"run",run:"fixture_run"}).history
  const snapshot={deck:history.deck,seq:history.seq,contributions:{history,applied:[edit.id,commandId("start_agent"),commandId("agent_other")]}}
  const client=new SyncClient("a",snapshot,outbox,()=>{})
  if(lost) await client.enqueue(edit)
  expect(client.historyTarget("undo")).toBe(edit.id)
  await client.enqueue({id:commandId("undo_saved"),kind:"undo",target:edit.id})
  expect(client.deck.slides[0]?.notes).toBe(deck.slides[0]?.notes)
  expect(client.deck.slides[1]?.notes).toBe("agent notes")
  const reloaded=new SyncClient("a",parseSnapshot(JSON.parse(JSON.stringify(snapshot))),outbox,()=>{})
  await reloaded.load()
  expect(reloaded.deck).toEqual(client.deck)
  expect(reloaded.historyTarget("redo")).toBe(edit.id)
  await reloaded.enqueue({id:commandId("redo_saved"),kind:"redo",target:edit.id})
  expect(reloaded.deck.slides[0]?.notes).toBe("saved person notes")
  expect(reloaded.deck.slides[1]?.notes).toBe("agent notes")
})

it("does not replay an undo whose acknowledgement was lost",async()=>{
  const {outbox}=memory(), deck=fixtureDeck(2)
  const edit=patch("saved_for_undo","saved")
  let history=execute(initialHistory(deck),edit).history
  const undo:Command={id:commandId("already_undone"),kind:"undo",target:edit.id}
  history=execute(history,undo).history
  const snapshot={deck:history.deck,seq:history.seq,contributions:{history,applied:[edit.id,undo.id]}}
  const client=new SyncClient("a",snapshot,outbox,()=>{})
  await client.enqueue(undo)
  await client.enqueue({id:commandId("redo_after_lost_ack"),kind:"redo",target:edit.id})
  expect(client.deck.slides[0]?.notes).toBe("saved")
  expect(client.history.events.find(event=>event.id===edit.id)?.active).toBe(true)
})

it("rejects malformed cached contribution history at the snapshot boundary",()=>{
  const history=execute(initialHistory(fixtureDeck(2)),patch("history_boundary")).history
  const snapshot={deck:history.deck,seq:history.seq,contributions:{history,applied:[commandId("history_boundary")]}}
  expect(parseSnapshot(snapshot).contributions?.history).toEqual(history)
  for(const invalid of [
    {...snapshot,seq:history.seq+1},
    {...snapshot,contributions:{...snapshot.contributions,history:{...history,deck:fixtureDeck(2)}}},
    {...snapshot,contributions:{...snapshot.contributions,history:{...history,events:[{...history.events[0],active:"yes"}]}}},
    {...snapshot,contributions:{...snapshot.contributions,applied:[42]}},
  ]) expect(()=>parseSnapshot(invalid)).toThrow()
})

it("does not send work retained by an obsolete connection after reconnect",async()=>{
  const {outbox}=memory()
  let waiting=false
  const reads:(()=>void)[]=[]
  const delayed:Outbox={write:outbox.write,read:async key=>{
    if(waiting)await new Promise<void>(resolve=>{reads.push(resolve)})
    return outbox.read(key)
  }}
  const client=new SyncClient("owner",{deck:fixtureDeck(1),seq:0},delayed,()=>{})
  await client.enqueue(patch("reconnect_once"))
  const old:Command[]=[],current:Command[]=[]
  vi.stubGlobal("window",{})
  vi.stubGlobal("navigator",{locks:{request:async(_key:string,deliver:()=>Promise<void>)=>deliver()}})
  try{
    waiting=true
    client.connected(command=>old.push(command))
    client.disconnected()
    client.connected(command=>current.push(command))
    expect(reads).toHaveLength(2)
    for(const resolve of reads)resolve()
    for(let n=0;n<10;n++)await Promise.resolve()
    expect(old).toEqual([])
    expect(current.map(command=>command.id)).toEqual(["reconnect_once"])
  }finally{client.disconnected();vi.unstubAllGlobals()}
})

it("keeps acknowledged work locked across disconnect until its checkpoint is durable",async()=>{
  const {outbox}=memory(),snapshot={deck:fixtureDeck(1),seq:0}
  const first=new SyncClient("owner",snapshot,outbox,()=>{}),second=new SyncClient("owner",snapshot,outbox,()=>{})
  await first.enqueue(patch("durable_once"));await second.load()
  let locked=Promise.resolve()
  vi.stubGlobal("window",{})
  vi.stubGlobal("navigator",{locks:{request:(_key:string,deliver:()=>Promise<void>)=>{locked=locked.then(deliver);return locked}}})
  let checkpoint:()=>void=()=>{}
  const durable=new Promise<void>(resolve=>{checkpoint=resolve})
  const sent:Command[]=[]
  try{
    first.connected(()=>{})
    for(let n=0;n<10;n++)await Promise.resolve()
    const acknowledged=first.acknowledge({id:commandId("durable_once"),kind:"applied",seq:1},durable)
    first.disconnected()
    second.connected(command=>sent.push(command))
    for(let n=0;n<10;n++)await Promise.resolve()
    expect(sent).toEqual([])
    checkpoint();await acknowledged;await locked
    expect(sent).toEqual([])
    expect(second.queue).toEqual([])
  }finally{checkpoint();first.disconnected();second.disconnected();vi.unstubAllGlobals()}
})
