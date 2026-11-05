import { expect,it,vi } from "vitest"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { SyncClient } from "../../../../packages/rpc/src/client.ts"
import { commandId,execute,initialHistory } from "../../../../packages/change-log/src/index.ts"
import { id } from "../../../../packages/deck/src/index.ts"
import type { Pending } from "../../../../packages/rpc/src/outbox.ts"
import { cachedSnapshot,transport } from "./transport.ts"

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
    expect(client.queue).toEqual([])
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
    const checkpoint=new SyncClient("owner",cachedSnapshot("owner",original.deck.id)!,outbox,()=>{})
    await checkpoint.load()
    expect(checkpoint.deck.slides[0]!.notes).toBe("acknowledged edit")
    expect(checkpoint.historyTarget("undo")).toBe(command.id)
  }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear()}
})
