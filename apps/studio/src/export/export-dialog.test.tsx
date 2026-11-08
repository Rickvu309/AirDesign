import {act} from "react"
import {createRoot} from "react-dom/client"
import {expect,it,vi} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {ExportDialog} from "./export-dialog.tsx"

it("explains a killed export and keeps its typed diagnostic behind Details",async()=>{
 const diagnostic=JSON.stringify({kind:"limit",limit:"wall-clock",signal:"SIGKILL"})
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>[{id:"failed-export",kind:"failed",format:"pdf",attempts:1,diagnostics:[diagnostic],reason:diagnostic,failure:{kind:"limit",limit:"wall-clock",signal:"SIGKILL"}}]})))
 const container=document.createElement("div");document.body.append(container)
 const root=createRoot(container)
 try{
  await act(async()=>root.render(<ExportDialog deck={fixtureDeck(1)} seq={0} open={false} close={()=>{}} fix={()=>{}} disabled={false}/>))
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Unable to export. Your deck is unchanged. The export reached its time limit. Try again.")
  expect(container.querySelector("details")?.open).toBe(false)
  expect(container.querySelector("details")?.textContent).toContain("SIGKILL")
  expect([...container.querySelectorAll("button")].some(button=>button.textContent==="Retry export")).toBe(true)
 }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
