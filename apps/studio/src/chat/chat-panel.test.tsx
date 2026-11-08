import {expect,it,vi} from "vitest"
import {act} from "react"
import {createRoot} from "react-dom/client"
import {contentLabel} from "../../../../packages/deck/src/content-labels.ts"
import {fixtureElement} from "../../../../packages/deck/src/fixture.ts"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {ChatPanel} from "./chat-panel.tsx"
it("replaces duplicate stream snapshots, exposes status and failures and keeps composer focus",async()=>{
  const streams:Stream[]=[]
  class Stream{onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;constructor(){streams.push(this)}close(){}}
  vi.stubGlobal("EventSource",Stream)
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={["s0"]} readonly={false} close={()=>{}}/>))
    const run={id:"aira_stable",owner:"owner",deck:"deck",request:"A long message ".repeat(100),selection:["s0"],kind:"working",completed:[],events:[{id:1,kind:"tool",name:"apply_changes",scope:"s0"}]}
    const send=(value:unknown)=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify(value)}))
    await act(async()=>send({enabled:true,run,remote:[]}))
    expect([...container.querySelectorAll("option")].map(option=>option.textContent)).toContain("Slide 1")
    expect(container.textContent).not.toContain("s0e0")
    expect(container.textContent).not.toContain("aira_stable")
    expect(container.querySelector(".aira-activity")).toBeNull()
    const input=container.querySelector("textarea")!;input.focus();expect(document.activeElement).toBe(input)
    await act(async()=>send({enabled:true,run,remote:[]}))
    expect(container.querySelectorAll(".aira-activity")).toHaveLength(0)
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
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={["s0"]} readonly={false} connected={false} close={()=>{}}/>))
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true)
    expect(container.querySelector("textarea")?.getAttribute("placeholder")).toBe("Waits for connection")
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it("shows separate slide and bar chart attachment chips without labelling icons as charts",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,base=slide.elements[0]!
  const chart={...base,kind:"group" as const,children:[fixtureElement(1),fixtureElement(4)]}
  slide.elements=[chart]
  expect(contentLabel({...chart,children:[fixtureElement(2)]})).toBe("Group")
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<ChatPanel deck={deck} selection={[slide.id,chart.id]} snapshot={{enabled:true,run:null,remote:[]}} readonly={false} close={()=>{}}/>))
    const chips=[...container.querySelectorAll(".aira-attachments button")]
    expect(chips.map(chip=>chip.textContent)).toEqual(["Slide 1 ×","Bar chart ×"])
    expect(chips[1]?.getAttribute("aria-label")).toBe("Remove Bar chart")
    expect(chips[0]?.querySelector("svg")).toBeNull()
    expect(chips[1]?.querySelector("svg")).not.toBeNull()
    await act(async()=>chips[1]!.dispatchEvent(new MouseEvent("click",{bubbles:true})))
    expect(container.querySelectorAll(".aira-attachments button")).toHaveLength(1)
  }finally{await act(async()=>root.unmount());container.remove()}
})

it("keeps activity compact and scope chips inside the composer, and loads real usage on demand",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const requests:string[]=[]
  vi.stubGlobal("fetch",async(url:string)=>{requests.push(url);return Response.json({used:3800,paid:1200,bonus:0,week:{resetsAt:1804483200000}})})
  try{
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(2,2)} selection={["s0"]} readonly={false} close={()=>{}} snapshot={{enabled:true,remote:[],run:{id:"run",owner:"owner",deck:"deck",request:"Refine",selection:["s0"],kind:"complete",completed:["s0"],events:[{id:1,kind:"tool",name:"get_deck"}]}}}/>))
    expect(container.querySelector(".aira-composer .aira-attachments button")?.getAttribute("aria-label")).toBe("Remove Slide 1")
    expect(container.querySelector(".aira-activity-log details")).toBeNull()
    expect(container.querySelector("details.aira-activity-log")).toBeNull()
    expect(container.querySelector(".aira-activity-log")?.textContent).toContain("Read deck content")
    expect(requests).toEqual([])
    const usage=container.querySelector<HTMLButtonElement>('button[aria-label="Usage"]')
    expect(usage).not.toBeNull()
    await act(async()=>usage?.click())
    expect(requests).toEqual(["/api/usage"])
    expect(container.querySelector('[aria-label="Usage details"]')?.textContent).toContain("38% used")
    expect(container.querySelector('a[aria-label="Manage usage and credits"]')?.getAttribute("title")).toBe("Credits $12.00")
    await act(async()=>container.querySelector<HTMLButtonElement>('.aira-composer .aira-attachments button')?.click())
    expect(container.querySelector(".aira-attachments button")).toBeNull()
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})

it("keeps the designed composer prompts and Undo label across real run states",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  const deck=fixtureDeck(1),base={id:"run",owner:"owner",deck:"deck",request:"Refine",selection:["s0"],completed:["s0"],events:[]}
  try{
    await act(async()=>root.render(<ChatPanel deck={deck} selection={["s0"]} readonly={false} close={()=>{}} snapshot={{enabled:true,remote:[],run:null}}/>))
    expect(container.querySelector("textarea")?.placeholder).toBe("Ask Aira")
    await act(async()=>root.render(<ChatPanel deck={deck} selection={["s0"]} readonly={false} close={()=>{}} snapshot={{enabled:true,remote:[],run:{...base,kind:"working"}}}/>))
    expect(container.querySelector("textarea")?.placeholder).toBe("Add to the request")
    await act(async()=>root.render(<ChatPanel deck={deck} selection={["s0"]} readonly={false} close={()=>{}} snapshot={{enabled:true,remote:[],run:{...base,kind:"complete"}}}/>))
    expect(container.querySelector(".aira-run-actions button")?.textContent).toBe("Undo")
  }finally{await act(async()=>root.unmount());container.remove()}
})

it("dismisses usage with Escape from its trigger and outside pointer, restoring keyboard focus",async()=>{
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  vi.stubGlobal("fetch",async()=>Response.json({used:0,paid:0,bonus:0,week:{resetsAt:1804483200000}}))
  try{
    await act(async()=>root.render(<ChatPanel deck={fixtureDeck(1)} selection={[]} readonly={false} close={()=>{}} snapshot={{enabled:true,remote:[],run:null}}/>))
    const usage=container.querySelector<HTMLButtonElement>('button[aria-label="Usage"]')!
    usage.focus();await act(async()=>usage.click())
    expect(usage.getAttribute("aria-expanded")).toBe("true")
    await act(async()=>usage.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})))
    expect(container.querySelector('[aria-label="Usage details"]')).toBeNull()
    expect(document.activeElement).toBe(usage)
    await act(async()=>usage.click())
    await act(async()=>document.body.dispatchEvent(new Event("pointerdown",{bubbles:true})))
    expect(container.querySelector('[aria-label="Usage details"]')).toBeNull()
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
    await act(async()=>streams[0]?.onmessage?.(new MessageEvent("message",{data:JSON.stringify({enabled:true,remote:[],run:{id:"saved",kind:"limited",request:"Polish this deck",selection:[],completed:[],events:[{id:1,kind:"limit",limit:{usage:{hit:"saved-hit",week:{resetsAt:1804483200000}}}}]}})})))
    await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Reset")!.click())
    expect(requests).toEqual(["/api/usage"])
    if(kind==="configured"){expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true);expect(container.textContent).toContain("$12.00");expect(container.textContent).toContain("Minimum $10.")}
    else{expect(document.body.textContent).toContain("Buying credits is not available yet");expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Continue to payment")).toBe(false)}
    expect(container.textContent).toContain("Polish this deck")
  }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.unstubAllGlobals()}
})
