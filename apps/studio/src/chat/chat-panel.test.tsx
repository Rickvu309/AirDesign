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
    const input=container.querySelector("textarea")!;input.focus();expect(document.activeElement).toBe(input)
    await act(async()=>send({enabled:true,run,remote:[]}))
    expect(container.querySelectorAll(".aira-activity")).toHaveLength(1)
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Working")
    expect(document.activeElement).toBe(input)
    await act(async()=>send({enabled:true,run:{...run,kind:"failed"},remote:[]}))
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Changes so far stay")
    expect(container.textContent).toContain("Resume")
    await act(async()=>send({enabled:true,run:{...run,kind:"stopped"},remote:[]}))
    expect(container.textContent).toContain("Resume")
    const requests:unknown[]=[]
    vi.stubGlobal("fetch",async(url:string,init:RequestInit)=>{if(url==="/api/usage")return Response.json({paid:1000,bonus:0,payments:{kind:"configured"}});requests.push({url,body:JSON.parse(String(init.body))});return Response.json({kind:"reset"})})
    await act(async()=>send({enabled:true,run:{...run,kind:"limited",events:[{id:2,kind:"limit",limit:{kind:"out-of-usage",usage:{hit:"saved-hit",paid:0,week:{resetsAt:1804483200000}}}}]},remote:[]}))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("this week's limit")
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(1804483200000).toISOString())
    expect(requests).toEqual([])
    const reset=[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset")!
    reset.focus();await act(async()=>reset.click())
    expect(requests).toEqual([])
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("$5")
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Cancel")!.click())
    expect(requests).toEqual([])
    expect(document.activeElement).toBe(reset)
    await act(async()=>reset.click())
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset"&&button.closest('[role="dialog"]'))!.click())
    expect(requests).toEqual([{url:"/api/usage/reset",body:{limitHit:"saved-hit"}}])
    expect(container.textContent).toContain("Pick up where you left off.")
    expect(container.querySelectorAll(".aira-usage-limit")).toHaveLength(1)
    expect(container.querySelector(".aira-usage-limit")?.textContent).not.toContain("this week’s limit")
    const resume=[...container.querySelectorAll("button")].find(button=>button.textContent==="Resume")!
    expect(document.activeElement).toBe(resume)
    expect(requests).toHaveLength(1)
    await act(async()=>resume.click())
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({url:expect.stringContaining("/api/aira/resume?deck=")})
    input.focus()
    await act(async()=>streams[0]?.onerror?.())
    expect([...container.querySelectorAll('[role="alert"]')].some(alert=>alert.textContent?.includes("Reconnecting"))).toBe(true)
    expect(document.activeElement).toBe(input)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it.each(["configured","unavailable"])("keeps an insufficient-credit request saved with payments %s",async(kind)=>{
  const streams:Stream[]=[],requests:string[]=[]
  class Stream{onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){streams.push(this)}close(){}}
  vi.stubGlobal("EventSource",Stream)
  vi.stubGlobal("fetch",async(url:string)=>{requests.push(url);return Response.json({paid:200,bonus:0,payments:{kind}})})
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={[]} readonly={false} close={()=>{}}/>))
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({enabled:true,remote:[],run:{id:"saved",kind:"limited",request:"Polish this deck",events:[{id:1,kind:"limit",limit:{usage:{hit:"saved-hit",week:{resetsAt:1804483200000}}}}]}})})))
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset")!.click())
    expect(requests).toEqual(["/api/usage"])
    if(kind==="configured"){expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true);expect(container.textContent).toContain("$12.00");expect(container.textContent).toContain("Minimum $10.")}
    else{expect(document.body.textContent).toContain("Buying credits is not available yet");expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Continue to payment")).toBe(false)}
    expect(container.textContent).toContain("Polish this deck")
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
