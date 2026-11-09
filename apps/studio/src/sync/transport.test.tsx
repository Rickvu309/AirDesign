import { expect,it,vi } from "vitest"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { SyncClient } from "../../../../packages/rpc/src/client.ts"
import { commandId,execute,initialHistory } from "../../../../packages/change-log/src/index.ts"
import { id } from "../../../../packages/deck/src/index.ts"
import type { Pending } from "../../../../packages/rpc/src/outbox.ts"
import { cachedSnapshot,transport } from "./transport.ts"

it.each(["manual","network-online"])("keeps an unacknowledged edit on its healthy connection after %s reconnect",async(trigger)=>{
  vi.useFakeTimers()
  const snapshot={deck:fixtureDeck(1),seq:0}
  let stored:Pending[]=[],deliver:((event:{data:string})=>void)|undefined
  const sent:string[]=[],errors:string[]=[]
  const client=new SyncClient("owner",snapshot,{read:async()=>stored,write:async(_key,items)=>{stored=items}},()=>{})
  vi.stubGlobal("requestIdleCallback",()=>1)
  class Socket{
    static OPEN=1
    readyState=1
    set onmessage(value:(event:{data:string})=>void){deliver=value}
    close(){this.readyState=3}
    send(value:string){sent.push(value)}
  }
  vi.stubGlobal("WebSocket",Socket)
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url==="/api/account" ? {json:async()=>({status:"signed-in",personId:"owner"})} : {ok:true,status:200}))
  const stop=transport(client,"owner",snapshot.deck.id,value=>errors.push(value))
  try{
    await vi.advanceTimersByTimeAsync(0)
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})})
    await vi.advanceTimersByTimeAsync(0)
    const command={id:commandId("healthy_connection_edit"),kind:"patch" as const,base:0,run:null,target:id("s0"),fields:{notes:"pending receipt"}}
    await client.enqueue(command)
    await vi.advanceTimersByTimeAsync(0)
    expect(sent.map(value=>JSON.parse(value).id)).toEqual([command.id])
    if(trigger==="manual")stop.reconnect()
    else window.dispatchEvent(new Event("online"))
    await vi.advanceTimersByTimeAsync(0)
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})})
    await vi.advanceTimersByTimeAsync(0)
    expect(sent.map(value=>JSON.parse(value).id)).toEqual([command.id])
    expect(client.queue.map(item=>item.command.id)).toEqual([command.id])
    expect(errors).toEqual([])
  }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()}
})

it("applies incoming snapshots without waiting for a frame and batches persisted snapshots",async()=>{
  vi.useFakeTimers()
  const snapshot={deck:fixtureDeck(1),seq:0}
  const client=new SyncClient("owner",snapshot,{read:async()=>[],write:async()=>{}},()=>{})
  const receive=vi.spyOn(client,"receive"),write=vi.spyOn(Storage.prototype,"setItem"),errors:string[]=[]
  let idle:(()=>void)|undefined
  vi.stubGlobal("requestIdleCallback",(callback:()=>void)=>{idle=callback;return 1})
  let deliver:((event:{data:string})=>void)|undefined
  class Socket {
    static OPEN=1
    readyState=1
    set onmessage(value:(event:{data:string})=>void){deliver=value}
    close(){}
    send(){}
  }
  vi.stubGlobal("WebSocket",Socket)
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url==="/api/account" ? {json:async()=>({status:"signed-in",personId:"owner"})} : {ok:true,status:200}))
  vi.stubGlobal("requestAnimationFrame",(callback:()=>void)=>setTimeout(callback,16))
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"})
  const stop=transport(client,"owner",snapshot.deck.id,value=>errors.push(value))
  try{
    for(let count=0;count<10;count++)await Promise.resolve()
    expect(deliver).toBeDefined()
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})})
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot,seq:1})})
    for(let count=0;count<10;count++)await Promise.resolve()
    expect(receive).toHaveBeenCalledTimes(2)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(80)
    expect(receive).toHaveBeenCalledTimes(2)
    expect(write).not.toHaveBeenCalled()
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot,seq:2})})
    for(let count=0;count<10;count++)await Promise.resolve()
    await vi.advanceTimersByTimeAsync(80)
    expect(idle).toBeUndefined()
    await vi.advanceTimersByTimeAsync(20)
    expect(write).not.toHaveBeenCalled()
    expect(idle).toBeDefined()
    idle!()
    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(write.mock.calls[0]![1]).seq).toBe(2)
    idle=undefined
    for(let seq=3;seq<=14;seq++){
      deliver!({data:JSON.stringify({kind:"snapshot",...snapshot,seq})})
      await vi.advanceTimersByTimeAsync(90)
    }
    expect(idle).toBeDefined()
    idle!()
    expect(write).toHaveBeenCalledTimes(2)
    expect(JSON.parse(write.mock.calls[1]![1]).seq).toBe(14)
    expect(errors).toEqual([])
  }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()}
})

it.each([40,180])("keeps an acknowledged edit and undo on offline reload at %i ms",async(delay)=>{
  vi.useFakeTimers();localStorage.clear()
  const original={deck:fixtureDeck(1),seq:0}
  const command={id:commandId("durable_edit"),kind:"patch" as const,base:0,run:null,target:id("s0"),fields:{notes:"acknowledged edit"}}
  const applied=execute(initialHistory(original.deck),command)
  const snapshot={deck:applied.history.deck,seq:applied.history.seq,contributions:{history:applied.history,applied:[command.id]}}
  let stored:Pending[]=[]
  const outbox={read:async()=>structuredClone(stored),write:async(_key:string,items:Pending[],removed:string[]=[])=>{stored=[...stored.filter(item=>!removed.includes(item.command.id)&&!items.some(next=>next.command.id===item.command.id)),...structuredClone(items)]}}
  const client=new SyncClient("owner",original,outbox,()=>{})
  await client.enqueue(command)
  localStorage.setItem(JSON.stringify(["snapshot","owner",original.deck.id]),JSON.stringify(original))
  let idle:(()=>void)|undefined,deliver:((event:{data:string})=>void)|undefined
  vi.stubGlobal("requestIdleCallback",(callback:()=>void)=>{idle=callback;return 1})
  class Socket{static OPEN=1;readyState=1;set onmessage(value:(event:{data:string})=>void){deliver=value}close(){}send(){}}
  vi.stubGlobal("WebSocket",Socket)
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url==="/api/account" ? {json:async()=>({status:"signed-in",personId:"owner"})} : {ok:true,status:200}))
  vi.stubGlobal("requestAnimationFrame",(callback:()=>void)=>setTimeout(callback,16))
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"})
  const stop=transport(client,"owner",original.deck.id,()=>{})
  try{
    for(let n=0;n<10;n++)await Promise.resolve()
    deliver!({data:JSON.stringify({kind:"receipt",...snapshot,receipt:applied.receipt})})
    await vi.advanceTimersByTimeAsync(delay)
    expect(client.queue).toHaveLength(1)
    expect(client.state.kind).toBe("pending")
    expect(stored).toHaveLength(1)
    const reload=new SyncClient("owner",cachedSnapshot("owner",original.deck.id)!,outbox,()=>{})
    await reload.load()
    expect(reload.deck.slides[0]!.notes).toBe("acknowledged edit")
    expect(reload.historyTarget("undo")).toBe(command.id)
    expect(execute(reload.history,{id:commandId("offline_undo"),kind:"undo",target:command.id}).history.deck.slides[0]!.notes).toBe(original.deck.slides[0]!.notes)
    await vi.advanceTimersByTimeAsync(200)
    idle!()
    for(let n=0;n<15;n++)await Promise.resolve()
    expect(stored).toEqual([])
    expect(client.queue).toEqual([])
    expect(client.state.kind).toBe("saved")
    const checkpoint=new SyncClient("owner",cachedSnapshot("owner",original.deck.id)!,outbox,()=>{})
    await checkpoint.load()
    expect(checkpoint.deck.slides[0]!.notes).toBe("acknowledged edit")
    expect(checkpoint.historyTarget("undo")).toBe(command.id)
  }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear()}
})

it("checkpoints the final recovery receipt promptly and yields once per batch",async()=>{
 vi.useFakeTimers();localStorage.clear()
 const deck=fixtureDeck(1),initial={deck,seq:0}
 let stored:Pending[]=[]
 const outbox={read:async()=>structuredClone(stored),write:async(_key:string,items:Pending[],removed:string[]=[])=>{stored=[...stored.filter(item=>!removed.includes(item.command.id)&&!items.some(next=>next.command.id===item.command.id)),...structuredClone(items)]}}
 const client=new SyncClient("owner",initial,outbox,()=>{})
 const commands=Array.from({length:16},(_,index)=>({id:commandId(`recovery_${index}`),kind:"patch" as const,base:0,run:null,target:id("s0"),fields:{notes:`recovery ${index}`}}))
 for(const command of commands)await client.enqueue(command)
 const frames=vi.fn((callback:()=>void)=>setTimeout(callback,16))
 vi.stubGlobal("requestAnimationFrame",frames)
 vi.stubGlobal("requestIdleCallback",()=>1)
 Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"})
 let deliver:((event:{data:string})=>void)|undefined
 class Socket{
  static OPEN=1
  readyState=1
  set onmessage(value:(event:{data:string})=>void){deliver=value}
  close(){}
  send(){}
 }
 vi.stubGlobal("WebSocket",Socket)
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>url==="/api/account" ? {json:async()=>({status:"signed-in",personId:"owner"})} : {ok:true,status:200}))
 const errors:string[]=[],stop=transport(client,"owner",deck.id,value=>errors.push(value))
 try{
  await vi.advanceTimersByTimeAsync(0)
  deliver!({data:JSON.stringify({kind:"snapshot",...initial})})
  await vi.advanceTimersByTimeAsync(0)
  let history=initialHistory(deck)
  for(const command of commands){
   const result=execute(history,command);history=result.history
   deliver!({data:JSON.stringify({kind:"receipt",receipt:result.receipt,deck:history.deck,seq:history.seq,contributions:{history,applied:commands.slice(0,history.seq).map(item=>item.id)}})})
  }
  await vi.advanceTimersByTimeAsync(90)
  expect(client.queue).toEqual([])
  expect(stored).toEqual([])
  expect(frames.mock.calls.length).toBeLessThanOrEqual(2)
  const checkpoint=cachedSnapshot("owner",deck.id)
  expect(checkpoint?.deck.slides[0]?.notes).toBe("recovery 15")
  expect(checkpoint?.seq).toBe(16)
  expect(errors).toEqual([])
 }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()}
})

it.each([false,true])("acknowledges an older receipt against the newer durable peer snapshot with recovery=%s",async(recovering)=>{
 vi.useFakeTimers();localStorage.clear()
 const deck=fixtureDeck(1),initial={deck,seq:0}
 let stored:Pending[]=[]
 const outbox={read:async()=>structuredClone(stored),write:async(_key:string,items:Pending[],removed:string[]=[])=>{stored=[...stored.filter(item=>!removed.includes(item.command.id)&&!items.some(next=>next.command.id===item.command.id)),...structuredClone(items)]}}
 const client=new SyncClient("owner",initial,outbox,()=>{})
 const command={id:commandId("older_receipt"),kind:"patch" as const,base:0,run:null,target:id("s0"),fields:{notes:"local edit"}}
 await client.enqueue(command)
 const queued={...command,id:commandId("still_pending"),fields:{notes:"newer peer edit"}}
 if(recovering)await client.enqueue(queued)
 vi.stubGlobal("requestAnimationFrame",(callback:()=>void)=>setTimeout(callback,16))
 vi.stubGlobal("requestIdleCallback",(callback:()=>void)=>{setTimeout(callback,0);return 1})
 Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"})
 let deliver:((event:{data:string})=>void)|undefined
 class Socket{
  static OPEN=1
  readyState=1
  set onmessage(value:(event:{data:string})=>void){deliver=value}
  close(){}
  send(){}
 }
 vi.stubGlobal("WebSocket",Socket)
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>url==="/api/account" ? {json:async()=>({status:"signed-in",personId:"owner"})} : {ok:true,status:200}))
 const errors:string[]=[],stop=transport(client,"owner",deck.id,value=>errors.push(value))
 try{
  await vi.advanceTimersByTimeAsync(0)
  deliver!({data:JSON.stringify({kind:"snapshot",...initial})})
  await vi.advanceTimersByTimeAsync(0)
  const local=execute(initialHistory(deck),command)
  const peer=execute(local.history,{...command,id:commandId("newer_peer"),base:1,fields:{notes:"newer peer edit"}})
  deliver!({data:JSON.stringify({kind:"snapshot",deck:peer.history.deck,seq:2,contributions:{history:peer.history,applied:[command.id,commandId("newer_peer")]}})})
  await vi.advanceTimersByTimeAsync(0)
  deliver!({data:JSON.stringify({kind:"receipt",receipt:local.receipt,deck:local.history.deck,seq:1,contributions:{history:local.history,applied:[command.id]}})})
  await vi.advanceTimersByTimeAsync(180)
  expect(client.queue.map(item=>item.command.id)).toEqual(recovering ? [queued.id] : [])
  expect(stored.map(item=>item.command.id)).toEqual(recovering ? [queued.id] : [])
  expect(client.deck.slides[0]?.notes).toBe("newer peer edit")
  expect(cachedSnapshot("owner",deck.id)?.seq).toBe(2)
  expect(cachedSnapshot("owner",deck.id)?.deck.slides[0]?.notes).toBe("newer peer edit")
  expect(errors).toEqual([])
 }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear()}
})
