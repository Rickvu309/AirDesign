import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {useDeck} from "./use-deck.ts"

vi.mock("../../../../packages/rpc/src/outbox.ts",async original=>({...await original<typeof import("../../../../packages/rpc/src/outbox.ts")>(),indexedOutbox:()=>({read:async()=>[],write:async()=>{}})}))

it("distinguishes delayed online startup, connected, real offline and reconnecting without an offline flash",async()=>{
  vi.useFakeTimers()
  const snapshot={deck:fixtureDeck(1),seq:0}
  let online=true,deliver:((event:{data:string})=>void)|undefined
  const phases:string[]=[]
  vi.spyOn(navigator,"onLine","get").mockImplementation(()=>online)
  vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0))
  vi.stubGlobal("cancelAnimationFrame",clearTimeout)
  vi.stubGlobal("fetch",async(url:string)=>({ok:true,status:200,json:async()=>url==="/api/account" ? {status:"signed-in",personId:"owner"} : url.startsWith("/api/catalog/") ? {title:"Strategy"} : snapshot}))
  class Socket{
    static OPEN=1
    readyState=1
    onclose:(()=>void)|undefined
    set onmessage(value:(event:{data:string})=>void){deliver=value}
    close(){this.readyState=3;this.onclose?.()}
    send(){}
  }
  vi.stubGlobal("WebSocket",Socket)
  function Probe(){const {sync,state,error}=useDeck(snapshot.deck.id);const kind=state?.kind ?? sync?.state.kind ?? "loading";phases.push(kind);return <p data-error={error}>{kind}</p>}
  const container=document.createElement("div"),root=createRoot(container)
  try{
    await act(async()=>root.render(<Probe/>))
    await act(async()=>vi.advanceTimersByTimeAsync(10))
    expect(container.innerHTML).not.toContain("data-error=\"")
    expect(container.textContent).toBe("connecting")
    await act(async()=>vi.advanceTimersByTimeAsync(3500))
    expect(container.textContent).toBe("connecting")
    expect(phases).not.toContain("offline")
    await act(async()=>{deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})});await vi.advanceTimersByTimeAsync(10)})
    expect(container.textContent).toBe("saved")
    online=false
    await act(async()=>{window.dispatchEvent(new Event("offline"));await vi.advanceTimersByTimeAsync(10)})
    expect(container.textContent).toBe("offline")
    await act(async()=>vi.advanceTimersByTimeAsync(3000))
    expect(container.textContent).toBe("retrying")
    online=true
    await act(async()=>{window.dispatchEvent(new Event("online"));await vi.advanceTimersByTimeAsync(10)})
    expect(container.textContent).toBe("connecting")
    await act(async()=>{deliver!({data:JSON.stringify({kind:"snapshot",...snapshot})});await vi.advanceTimersByTimeAsync(10)})
    expect(container.textContent).toBe("saved")
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear();sessionStorage.clear()}
})

it("keeps an online service failure unavailable across automatic retries",async()=>{
  vi.useFakeTimers()
  let deckRequests=0
  const snapshot={deck:fixtureDeck(1),seq:0},phases:string[]=[]
  vi.spyOn(navigator,"onLine","get").mockReturnValue(true)
  vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0))
  vi.stubGlobal("cancelAnimationFrame",clearTimeout)
  vi.stubGlobal("fetch",async(url:string)=>{
    if(url==="/api/account")return Response.json({status:"signed-in",personId:"owner"})
    if(url.startsWith("/api/catalog/"))return Response.json({title:"Strategy"})
    if(++deckRequests===1)return Response.json(snapshot)
    await new Promise(resolve=>setTimeout(resolve,10))
    return new Response(null,{status:503})
  })
  function Probe(){const {state}=useDeck(snapshot.deck.id);const kind=state?.kind ?? "loading";phases.push(kind);return <p>{kind}</p>}
  const container=document.createElement("div"),root=createRoot(container)
  try{
    await act(async()=>root.render(<Probe/>))
    await act(async()=>vi.advanceTimersByTimeAsync(20))
    expect(container.textContent).toBe("unavailable")
    const firstFailure=phases.indexOf("unavailable")
    await act(async()=>vi.advanceTimersByTimeAsync(495))
    expect(container.textContent).toBe("unavailable")
    await act(async()=>vi.advanceTimersByTimeAsync(4000))
    expect(deckRequests).toBe(5)
    expect(phases.slice(firstFailure)).not.toContain("connecting")
    expect(phases).not.toContain("offline")
    expect(container.textContent).toBe("unavailable")
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear();sessionStorage.clear()}
})
