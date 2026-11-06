import {expect,it,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {AddCredits} from "./add-credits.tsx"
it("announces pending, paid, refund and error states without moving focus or granting from a browser return",async()=>{
  sessionStorage.clear()
  const streams:Stream[]=[],requests:string[]=[]
  class Stream{closed=false;onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){streams.push(this)}close(){this.closed=true}}
  vi.stubGlobal("EventSource",Stream)
  const payment={id:"12345678-1234-1234-1234-123456789abc",cents:2500,kind:"pending",expires:Date.now()+1800000}
  vi.stubGlobal("fetch",async(url:string)=>{requests.push(url);return Response.json({payment})})
  const refresh=vi.fn(async()=>{}),container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AddCredits refresh={refresh}/>))
    const button=container.querySelector("button")!;button.focus()
    await act(async()=>button.click())
    await act(async()=>Array.from(container.querySelectorAll("button")).find(value=>value.textContent==="Continue to payment")!.click())
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Waiting")
    expect(requests).toEqual(["/api/billing/checkout"])
    expect(refresh).not.toHaveBeenCalled();expect(document.activeElement).toBe(button)
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"paid"})})))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Credits added")
    expect(streams[0]?.closed).toBe(false)
    expect(refresh).toHaveBeenCalledTimes(1);expect(document.activeElement).toBe(button)
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"reversed"})})))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("bonus credit is kept")
    await act(async()=>streams[0]?.onerror?.())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("interrupted")
    expect(document.activeElement).toBe(button)
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
