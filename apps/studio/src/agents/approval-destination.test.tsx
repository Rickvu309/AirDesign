import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {createAccessClient} from "@airdesign/access/client"
import {AgentApproval} from "./agents-panel.tsx"

it.each([["Claude","claude.ai"],["Codex","Codex on this computer"],["Research agent","Research agent"]])("explains the return destination for %s before permission is granted",async(name,destination)=>{
  const requests:string[]=[]
  vi.stubGlobal("fetch",async(url:string,init?:RequestInit)=>{if(init?.method==="POST"){requests.push(url);return Response.json({redirect:"http://127.0.0.1:49199/callback?code=approved"})}return Response.json(url.includes("approval") ? {client:name,scope:"decks",expired:false} : {status:"signed-in",personId:"owner",displayName:"Rick",email:"rick@example.com"})})
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container)
  try{
    await act(async()=>root.render(<AgentApproval intent="approval" client={createAccessClient("")}/>))
    expect(container.querySelector(".agent-footnote")?.textContent).toContain(`Returns you to ${destination}.`)
    expect(requests).toEqual([])
    const action0=[...container.querySelectorAll("button")].find(button=>button.textContent==="Allow")
    if(!action0)throw new Error("missing-allow-action")
    await act(async()=>action0.click())
    expect(requests).toEqual(["/api/agents/approval"])
    expect(container.querySelector('a[target="_blank"]')?.textContent).toBe(`Return to ${name}`)
    expect(container.textContent).toContain("Ready to return to your agent")
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
