import { expect, it } from "vitest"
import { SyncClient } from "../src/client.ts"
import { outboxKey, type Outbox, type Pending } from "../src/outbox.ts"
import { commandId, type Command } from "../../change-log/src/index.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"
import { id } from "../../deck/src/index.ts"

function patch(name: string, notes=name): Command { return {id:commandId(name),kind:"patch",base:0,run:null,target:id("s0"),fields:{notes}} }
function memory() {
  const storage=new Map<string,Pending[]>()
  const outbox:Outbox={read:async key=>structuredClone(storage.get(key) ?? []),write:async(key,items)=>{storage.set(key,structuredClone(items))}}
  return {storage,outbox}
}
it("paints immediately, persists before sending and never loses typing during an acknowledgement",async()=>{
  const {outbox,storage}=memory()
  let release:()=>void=()=>{}
  const written=new Promise<void>(resolve=>{release=resolve})
  const delayed:Outbox={read:outbox.read,write:async(key,items)=>{await written;await outbox.write(key,items)}}
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
