import {expect,it,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {AddCredits} from "./add-credits.tsx"
it("opens a recoverable payment failure dialog when the network fails",async()=>{
  vi.stubGlobal("fetch",async()=>{throw new TypeError("Failed to fetch")})
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AddCredits refresh={async()=>{}}/>))
    await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click())
    const submit=Array.from(container.querySelectorAll("button")).find(button=>button.textContent==="Continue to payment")!;submit.focus()
    await act(async()=>submit.click())
    expect(container.querySelector("dialog")?.textContent).toContain("Your credits are safe. Try again.")
    expect(container.querySelector("dialog")?.textContent).not.toContain("TypeError")
    expect(container.querySelector("h2")?.textContent).toBe("Unable to complete payment");expect(document.activeElement).toBe(container.querySelector("[data-credits-close]"));expect([...container.querySelectorAll("button")].find(button=>button.textContent==="Try again")?.disabled).toBe(false)
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
it("offers a retry for expiry and keeps embedded checkout mounted while waiting",async()=>{
  sessionStorage.clear()
  let receive:((event:MessageEvent)=>void)|null=null
  class Stream{set onmessage(value:((event:MessageEvent)=>void)|null){receive=value}onerror:(()=>void)|null=null;close(){}}
  vi.stubGlobal("EventSource",Stream)
  const payment={id:"12345678-1234-1234-1234-123456789abc",cents:1000,kind:"pending",expires:Date.now()+1800000}
  vi.stubGlobal("fetch",async()=>Response.json({payment,url:"/settings/usage?payment=fixture"}))
  const openPayment=vi.fn();vi.stubGlobal("open",openPayment)
  const close=vi.fn(),refresh=vi.fn(async()=>{}),container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AddCredits open balance={200} refresh={refresh} onClose={close}/>))
    expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true)
    expect(container.querySelector(".credits-footnote")?.textContent).toBe("Opens a secure page in a new tab.")
    expect(container.querySelector(".credits-preview")?.textContent).toContain("$12.00")
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Continue to payment")!.click())
    expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(false)
    expect(close).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled()
    expect(openPayment).toHaveBeenCalledWith("/settings/usage?payment=fixture","_blank","noopener,noreferrer")
    expect(container.querySelector(".payment-status a")?.getAttribute("href")).toBe("/settings/usage?payment=fixture")
    await act(async()=>receive?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"expired"})})))
    expect(container.querySelector("h2")?.textContent).toBe("Payment expired")
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Try again")!.click())
    expect(container.querySelector("h2")?.textContent).toBe("Add credits")
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("10")
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
it("announces pending, paid, refund and error states without granting from a browser return",async()=>{
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
    const focused=container.querySelector<HTMLButtonElement>("[data-credits-close]")!;expect(container.querySelector("dialog")?.open).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"paid"})})))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Credits added")
    expect(streams[0]?.closed).toBe(false)
    expect(refresh).toHaveBeenCalledTimes(1);expect(container.querySelector("dialog")?.open).toBe(true);expect(document.activeElement).toBe(focused)
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"reversed"})})))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("bonus credit is kept")
    await act(async()=>streams[0]?.onerror?.())
    expect(container.querySelector("dialog")?.textContent).toContain("interrupted")
    expect(document.activeElement).toBe(focused)
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})

it("keeps a paid confirmation truthful if refreshing the balance fails",async()=>{
  const streams:Stream[]=[]
  class Stream{onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){streams.push(this)}close(){}}
  vi.stubGlobal("EventSource",Stream)
  const payment={id:"12345678-1234-1234-1234-123456789abc",cents:2500,kind:"pending",expires:Date.now()+1800000}
  vi.stubGlobal("fetch",async()=>Response.json({payment}))
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AddCredits balance={1500} refresh={async()=>{throw new Error("offline")}}/>))
    await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click())
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Continue to payment")!.click())
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({...payment,kind:"paid"})})))
    expect(container.querySelector("h2")?.textContent).toBe("$25.00 added")
    expect(container.textContent).toContain("Open Usage to check your updated balance.")
    expect(container.textContent).not.toContain("Your balance is now $15.00")
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to refresh your balance")
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})

it("reopens the same pending amount and checkout after remount without another purchase",async()=>{
  sessionStorage.clear()
  class Stream{onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;close(){}}
  vi.stubGlobal("EventSource",Stream)
  const payment={id:"12345678-1234-1234-1234-123456789abc",cents:2500,kind:"pending",expires:Date.now()+1800000}
  const url="https://checkout.example.test/existing-25"
  const request=vi.fn(async(path:string)=>Response.json(path.endsWith("/checkout") ? {payment,url} : payment))
  vi.stubGlobal("fetch",request)
  const openPayment=vi.fn();vi.stubGlobal("open",openPayment)
  const container=document.createElement("div");document.body.append(container);let root=createRoot(container)
  try{
    await act(async()=>root.render(<AddCredits refresh={async()=>{}}/>))
    await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click())
    await act(async()=>[...container.querySelectorAll("button")].find(value=>value.textContent==="$25")!.click())
    await act(async()=>[...container.querySelectorAll("button")].find(value=>value.textContent==="Continue to payment")!.click())
    await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click())
    expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(false)
    expect(container.querySelector(".payment-status")?.textContent).toContain("$25.00")
    expect(openPayment).toHaveBeenCalledTimes(2)
    expect(openPayment).toHaveBeenLastCalledWith(url,"_blank","noopener,noreferrer")
    expect(request.mock.calls.filter(([path])=>path.endsWith("/checkout"))).toHaveLength(1)
    await act(async()=>root.unmount());root=createRoot(container)
    await act(async()=>root.render(<AddCredits refresh={async()=>{}}/>))
    await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click())
    expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(false)
    expect(container.querySelector(".payment-status a")?.getAttribute("href")).toBe(url)
    expect(container.querySelector(".payment-status")?.textContent).toContain("$25.00")
    expect(openPayment).toHaveBeenCalledTimes(3)
    expect(request.mock.calls.filter(([path])=>path.endsWith("/checkout"))).toHaveLength(1)
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
