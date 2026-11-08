import {it,expect,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {UsagePanel} from "./usage-panel.tsx"
it("keeps the request at zero credits and offers explicit credits and automatic reset controls",async()=>{
  const requests:string[]=[]
  vi.stubGlobal("fetch",async(url:string)=>{requests.push(url);return Response.json(url.endsWith("/history") ? {items:[],nextCursor:null} : {payments:{kind:"configured"},used:10000,remaining:0,paid:0,bonus:0,hit:"hit",autoReset:false,week:{zone:"UTC",resetsAt:1804483200000}})})
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>{root.render(<UsagePanel/>);await new Promise(resolve=>setTimeout(resolve,20))})
    const auto=container.querySelector('input[type="checkbox"]')
    expect(auto?.hasAttribute("disabled")).toBe(false)
    expect(container.textContent).toContain("at most three times a week")
    const reset=[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset")
    expect(reset).toBeTruthy()
    await act(async()=>reset?.click())
    expect(document.body.textContent).toContain("Add credits to reset")
    expect(document.body.textContent).toContain("Your request is saved")
    expect(document.body.textContent).toContain("Add credits below")
    expect(document.body.textContent).toContain("Add credits")
    expect(requests.every(url=>!url.endsWith("/reset")&&!url.endsWith("/configure"))).toBe(true)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it("shows financial history amounts and preserves refunds without exposing usage reservation records",async()=>{
  const items=[{id:"add",kind:"payment-credit",at:1804483200000,data:{cents:2500}},{id:"reset",kind:"credit-reset",at:1804483200000,data:{}},{id:"refund",kind:"refunded",at:1804483200000,data:{cents:2500,removed:2000}},{id:"reserve",kind:"usage-reserved",at:1804483200000,data:{}}]
  vi.stubGlobal("fetch",async(url:string)=>Response.json(url.endsWith("/history") ? {items,nextCursor:null} : {payments:{kind:"unavailable"},used:6200,remaining:3800,paid:1000,bonus:0,autoReset:false,week:{zone:"UTC",resetsAt:1804483200000}}))
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<UsagePanel/>))
    const history=container.querySelector(".usage-history")
    if(!history)throw new Error("missing-usage-history")
    expect(history.textContent).toContain("+$25.00");expect(history.textContent).toContain("-$5.00");expect(history.textContent).toContain("Payment refunded");expect(history.textContent).toContain("-$20.00")
    expect(history.textContent).not.toContain("usage-reserved");expect(history.querySelectorAll("li")).toHaveLength(3)
    expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Add credits")).toBe(false)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
