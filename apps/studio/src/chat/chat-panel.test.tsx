import {expect,it,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {ChatPanel} from "./chat-panel.tsx"
it("replaces duplicate stream snapshots, exposes status and failures and keeps composer focus",async()=>{
  const streams:Stream[]=[]
  class Stream{onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){streams.push(this)}close(){}}
  vi.stubGlobal("EventSource",Stream)
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={["s0"]} readonly={false} close={()=>{}}/>))
    const run={id:"aira_stable",owner:"owner",deck:"deck",request:"A long message ".repeat(100),selection:["s0"],kind:"working",events:[{id:1,kind:"tool",name:"apply_changes",scope:"s0"}]}
    const send=(value:unknown)=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify(value)}))
    await act(async()=>send({enabled:true,run,remote:[]}))
    expect([...container.querySelectorAll("option")].map(option=>option.textContent)).toContain("Slide 1")
    expect(container.textContent).not.toContain("s0e0")
    expect(container.textContent).not.toContain("aira_stable")
    expect(container.querySelector(".aira-activity")?.textContent).toBe("✓ Updated Slide 1")
    const input=container.querySelector("textarea")!;input.focus();expect(document.activeElement).toBe(input)
    await act(async()=>send({enabled:true,run,remote:[]}))
    expect(container.querySelectorAll(".aira-activity")).toHaveLength(1)
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Working")
    expect(document.activeElement).toBe(input)
    await act(async()=>send({enabled:true,run:{...run,kind:"failed"},remote:[]}))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Changes so far stay")
    expect(container.textContent).toContain("Resume")
    expect(container.querySelector(".aira-failure-card .aira-run-actions")?.textContent).toContain("Resume")
    expect(container.querySelector(".aira-failure-card strong")?.textContent).toContain("Unable to finish this run")
    await act(async()=>send({enabled:true,run:{...run,kind:"stopped"},remote:[]}))
    expect(container.textContent).toContain("Resume")
    const requests:unknown[]=[]
    vi.stubGlobal("fetch",async(url:string,init:RequestInit)=>{requests.push({url,body:JSON.parse(String(init.body))});return Response.json({kind:"reset"})})
    await act(async()=>send({enabled:true,run:{...run,kind:"limited",events:[{id:2,kind:"limit",limit:{kind:"out-of-usage",usage:{hit:"saved-hit",paid:0,week:{resetsAt:1804483200000}}}}]},remote:[]}))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("weekly usage")
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(1804483200000).toISOString())
    expect(requests).toEqual([])
    const reset=[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset usage")!
    reset.focus();await act(async()=>reset.click())
    expect(requests).toEqual([])
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("$5")
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Cancel")!.click())
    expect(requests).toEqual([])
    expect(document.activeElement).toBe(reset)
    await act(async()=>reset.click())
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset for $5")!.click())
    expect(requests).toEqual([{url:"/api/usage/reset",body:{limitHit:"saved-hit"}}])
    expect(document.activeElement).toBe(reset)
    input.focus()
    await act(async()=>streams[0]?.onerror?.())
    expect([...container.querySelectorAll('[role="alert"]')].some(alert=>alert.textContent?.includes("Reconnecting"))).toBe(true)
    expect(document.activeElement).toBe(input)
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={["s0"]} readonly={false} connected={false} close={()=>{}}/>))
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true)
    expect(container.querySelector("textarea")?.getAttribute("placeholder")).toBe("Waits for connection")
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
