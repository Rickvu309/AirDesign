import { expect,it,vi } from "vitest"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { SyncClient } from "../../../../packages/rpc/src/client.ts"
import { transport } from "./transport.ts"

it("yields a paint before receipt reconciliation and batches persisted snapshots",async()=>{
  vi.useFakeTimers()
  const snapshot={deck:fixtureDeck(1),seq:0}
  const client=new SyncClient("owner",snapshot,{read:async()=>[],write:async()=>{}},()=>{})
  const receive=vi.spyOn(client,"receive"),write=vi.spyOn(Storage.prototype,"setItem"),errors:string[]=[]
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
    deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})})
    await Promise.resolve()
    expect(receive.mock.calls.length).toBe(0)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(80)
    expect(receive).toHaveBeenCalledTimes(2)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(write).toHaveBeenCalledTimes(1)
    expect(errors).toEqual([])
  }finally{stop.close();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()}
})
