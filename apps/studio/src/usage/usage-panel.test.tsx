import {it,expect,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {UsagePanel} from "./usage-panel.tsx"
it("keeps the request at zero credits and offers explicit credits and automatic reset controls",async()=>{
  const requests:string[]=[]
  vi.stubGlobal("fetch",async(url:string)=>{requests.push(url);return Response.json(url.endsWith("/history") ? {items:[],nextCursor:null} : {used:10000,remaining:0,paid:0,bonus:0,hit:"hit",autoReset:false,week:{zone:"UTC",resetsAt:1804483200000}})})
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
