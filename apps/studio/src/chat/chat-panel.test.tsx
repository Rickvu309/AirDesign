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
    await act(async()=>streams[0]?.onerror?.())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Reconnecting")
    expect(document.activeElement).toBe(input)
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
